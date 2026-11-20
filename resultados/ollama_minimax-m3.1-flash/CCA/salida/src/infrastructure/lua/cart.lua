-- Atomic cart mutation executed inside Redis (single-threaded => no lost updates).
--
-- KEYS[1] cart key
-- KEYS[2] events stream key ('' disables the transactional outbox)
-- ARGV[1] operation: create | add_item | set_quantity | remove_item | clear | apply_promo | remove_promo | checkout
-- ARGV[2] operation payload (JSON)
-- ARGV[3] expected version (-1 = last write wins)
-- ARGV[4] pricing rules (JSON)
-- ARGV[5] updatedAt (ISO)
-- ARGV[6] expiresAt (ISO)
-- ARGV[7] ttl seconds
-- ARGV[8] event template (JSON, '' disables the event)
-- ARGV[9] events stream max length
--
-- Returns {status, version, payload}
--   status = ok | not_found | conflict | invalid

local key = KEYS[1]
local streamKey = KEYS[2]
local op = ARGV[1]
local payloadJson = ARGV[2]
local expectedVersion = tonumber(ARGV[3])
local rules = cjson.decode(ARGV[4])
local nowIso = ARGV[5]
local expiresAtIso = ARGV[6]
local ttl = tonumber(ARGV[7])
local eventTemplate = ARGV[8]
local streamMaxLen = tonumber(ARGV[9])

local function applyBps(amount, bps)
  if bps <= 0 then
    return 0
  end
  return math.floor((amount * bps) / 10000)
end

local function resolveBps(breaks, quantity)
  local best = 0
  if breaks == nil then
    return 0
  end
  for _, br in ipairs(breaks) do
    if quantity >= br.minQuantity and br.discountBps > best then
      best = br.discountBps
    end
  end
  return best
end

local function findLine(cart, lineId)
  for _, item in ipairs(cart.items) do
    if item.lineId == lineId then
      return item
    end
  end
  return nil
end

-- Recalculates every monetary figure of the cart. Mirrors
-- src/domain/pricing.ts exactly (same order of operations, integer maths).
local function computeTotals(cart)
  local subtotal = 0
  local discount = 0
  local net = 0
  local itemCount = 0

  for _, item in ipairs(cart.items) do
    local gross = item.unitPriceCents * item.quantity
    local volDiscount = applyBps(gross, item.discountBps)
    subtotal = subtotal + gross
    discount = discount + volDiscount
    net = net + (gross - volDiscount)
    itemCount = itemCount + item.quantity
  end

  local promoTotal = 0
  local remaining = net

  if cart.promoCodes ~= nil then
    for _, code in ipairs(cart.promoCodes) do
      local rule = rules.promos[code]
      if rule ~= nil then
        local amount = 0
        local applicable = true
        if rule.minSubtotalCents ~= nil and remaining < rule.minSubtotalCents then
          applicable = false
        end
        if applicable then
          if rule.type == 'percent' then
            amount = applyBps(remaining, rule.bps)
            if rule.maxDiscountCents ~= nil and amount > rule.maxDiscountCents then
              amount = rule.maxDiscountCents
            end
          else
            amount = rule.amountCents
          end
        end
        if amount > remaining then
          amount = remaining
        end
        if amount > 0 then
          promoTotal = promoTotal + amount
          remaining = remaining - amount
        end
      end
    end
  end

  local netAfterPromo = net - promoTotal
  local shipping = 0
  if netAfterPromo ~= 0 and netAfterPromo < rules.freeShippingThresholdCents then
    shipping = rules.shippingFlatCents
  end
  local tax = applyBps(netAfterPromo + shipping, rules.taxBps)
  local total = netAfterPromo + shipping + tax

  local assigned = 0
  local count = #cart.items
  local index = 0
  for _, item in ipairs(cart.items) do
    index = index + 1
    local gross = item.unitPriceCents * item.quantity
    item.discountCents = applyBps(gross, item.discountBps)
    local share = 0
    if promoTotal > 0 and net > 0 then
      if index == count then
        share = promoTotal - assigned
      else
        share = math.floor((promoTotal * (gross - item.discountCents)) / net)
      end
      assigned = assigned + share
    end
    item.promoCents = share
    item.lineTotalCents = gross - item.discountCents - share
  end

  cart.totals = {
    currency = cart.currency,
    subtotalCents = subtotal,
    discountCents = discount,
    promoCents = promoTotal,
    shippingCents = shipping,
    taxCents = tax,
    totalCents = total,
    itemCount = itemCount,
  }
end

-- Transactional outbox: the domain event is written to the stream in the very
-- same script as the mutation, so an event can never be lost nor emitted
-- without its state change.
local function emitEvent(cart)
  if streamKey == '' or eventTemplate == '' then
    return
  end
  local event = cjson.decode(eventTemplate)
  event.cartId = cart.id
  event.version = cart.version
  redis.call(
    'XADD', streamKey, 'MAXLEN', '~', streamMaxLen, '*',
    'type', event.type,
    'id', event.id,
    'cartId', cart.id,
    'version', tostring(cart.version),
    'occurredAt', event.occurredAt,
    'actorId', event.actorId or '',
    'data', cjson.encode(event.payload)
  )
end

if op == 'create' then
  if redis.call('EXISTS', key) == 1 then
    return { 'invalid', '0', 'CART_ALREADY_EXISTS' }
  end
  local cart = cjson.decode(payloadJson)
  cart.version = 1
  cart.createdAt = nowIso
  cart.updatedAt = nowIso
  cart.expiresAt = expiresAtIso
  computeTotals(cart)
  local encoded = cjson.encode(cart)
  redis.call('SET', key, encoded, 'EX', ttl)
  emitEvent(cart)
  return { 'ok', '1', encoded }
end

local raw = redis.call('GET', key)
if not raw then
  return { 'not_found', '-1', '' }
end

local cart = cjson.decode(raw)

if cart.status ~= 'active' then
  return { 'invalid', tostring(cart.version), 'CART_ALREADY_CHECKED_OUT' }
end

if expectedVersion >= 0 and cart.version ~= expectedVersion then
  return { 'conflict', tostring(cart.version), raw }
end

local maxQty = rules.limits.maxQuantityPerLine
local maxItems = rules.limits.maxItems

if op == 'add_item' then
  local p = cjson.decode(payloadJson)
  local item = p.item
  if item.quantity == nil or item.quantity <= 0 or item.quantity > maxQty then
    return { 'invalid', tostring(cart.version), 'INVALID_QUANTITY' }
  end
  local existing = findLine(cart, item.lineId)
  if existing ~= nil then
    local newQty = existing.quantity + item.quantity
    if newQty > maxQty then
      return { 'invalid', tostring(cart.version), 'INVALID_QUANTITY' }
    end
    existing.quantity = newQty
    existing.discountBps = resolveBps(existing.volumeBreaks, newQty)
  else
    if #cart.items >= maxItems then
      return { 'invalid', tostring(cart.version), 'CART_LIMIT_EXCEEDED' }
    end
    item.discountBps = resolveBps(item.volumeBreaks, item.quantity)
    item.discountCents = 0
    item.promoCents = 0
    item.lineTotalCents = 0
    table.insert(cart.items, item)
  end
elseif op == 'set_quantity' then
  local p = cjson.decode(payloadJson)
  local qty = tonumber(p.quantity)
  if qty == nil or qty < 0 or qty > maxQty then
    return { 'invalid', tostring(cart.version), 'INVALID_QUANTITY' }
  end
  local existing = findLine(cart, p.lineId)
  if existing == nil then
    return { 'invalid', tostring(cart.version), 'CART_LINE_NOT_FOUND' }
  end
  if qty == 0 then
    for i, item in ipairs(cart.items) do
      if item.lineId == p.lineId then
        table.remove(cart.items, i)
        break
      end
    end
  else
    existing.quantity = qty
    existing.discountBps = resolveBps(existing.volumeBreaks, qty)
  end
elseif op == 'remove_item' then
  local p = cjson.decode(payloadJson)
  local existing = findLine(cart, p.lineId)
  if existing == nil then
    return { 'invalid', tostring(cart.version), 'CART_LINE_NOT_FOUND' }
  end
  for i, item in ipairs(cart.items) do
    if item.lineId == p.lineId then
      table.remove(cart.items, i)
      break
    end
  end
elseif op == 'clear' then
  cart.items = {}
  cart.promoCodes = {}
elseif op == 'apply_promo' then
  local p = cjson.decode(payloadJson)
  local code = p.code
  if rules.promos == nil or rules.promos[code] == nil then
    return { 'invalid', tostring(cart.version), 'PROMO_NOT_FOUND' }
  end
  local applied = false
  if cart.promoCodes ~= nil then
    for _, existingCode in ipairs(cart.promoCodes) do
      if existingCode == code then
        applied = true
        break
      end
    end
  end
  if not applied then
    table.insert(cart.promoCodes, code)
  end
elseif op == 'remove_promo' then
  local p = cjson.decode(payloadJson)
  for i, code in ipairs(cart.promoCodes) do
    if code == p.code then
      table.remove(cart.promoCodes, i)
      break
    end
  end
elseif op == 'checkout' then
  cart.status = 'checked_out'
else
  return { 'invalid', tostring(cart.version), 'UNKNOWN_OPERATION' }
end

computeTotals(cart)
cart.version = cart.version + 1
cart.updatedAt = nowIso
cart.expiresAt = expiresAtIso

local encoded = cjson.encode(cart)
redis.call('SET', key, encoded, 'EX', ttl)
emitEvent(cart)

return { 'ok', tostring(cart.version), encoded }
