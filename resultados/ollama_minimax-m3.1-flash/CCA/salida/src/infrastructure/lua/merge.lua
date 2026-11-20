-- Atomic merge of a guest cart (source) into the owner cart (target).
--
-- KEYS[1] target cart key
-- KEYS[2] source cart key
-- KEYS[3] events stream key ('' disables the transactional outbox)
-- ARGV[1] expected target version (-1 = last write wins)
-- ARGV[2] pricing rules (JSON)
-- ARGV[3] updatedAt (ISO)
-- ARGV[4] expiresAt (ISO)
-- ARGV[5] ttl seconds
-- ARGV[6] event template (JSON, '' disables the event)
-- ARGV[7] events stream max length
--
-- Returns {status, version, payload}
--   status = ok | not_found | source_not_found | conflict | invalid

local targetKey = KEYS[1]
local sourceKey = KEYS[2]
local streamKey = KEYS[3]
local expectedVersion = tonumber(ARGV[1])
local rules = cjson.decode(ARGV[2])
local nowIso = ARGV[3]
local expiresAtIso = ARGV[4]
local ttl = tonumber(ARGV[5])
local eventTemplate = ARGV[6]
local streamMaxLen = tonumber(ARGV[7])

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

local targetRaw = redis.call('GET', targetKey)
if not targetRaw then
  return { 'not_found', '-1', '' }
end

local target = cjson.decode(targetRaw)

if target.status ~= 'active' then
  return { 'invalid', tostring(target.version), 'CART_ALREADY_CHECKED_OUT' }
end

if expectedVersion >= 0 and target.version ~= expectedVersion then
  return { 'conflict', tostring(target.version), targetRaw }
end

local sourceRaw = redis.call('GET', sourceKey)
if not sourceRaw then
  return { 'source_not_found', tostring(target.version), '' }
end

local source = cjson.decode(sourceRaw)

if source.status == 'active' then
  local maxQty = rules.limits.maxQuantityPerLine
  local maxItems = rules.limits.maxItems

  for _, srcItem in ipairs(source.items) do
    local existing = findLine(target, srcItem.lineId)
    if existing ~= nil then
      local newQty = existing.quantity + srcItem.quantity
      if newQty > maxQty then
        newQty = maxQty
      end
      existing.quantity = newQty
      existing.discountBps = resolveBps(existing.volumeBreaks, newQty)
    elseif #target.items < maxItems then
      local copy = {
        lineId = srcItem.lineId,
        productId = srcItem.productId,
        variantId = srcItem.variantId,
        sku = srcItem.sku,
        name = srcItem.name,
        unitPriceCents = srcItem.unitPriceCents,
        quantity = srcItem.quantity,
        discountBps = resolveBps(srcItem.volumeBreaks, srcItem.quantity),
        discountCents = 0,
        promoCents = 0,
        lineTotalCents = 0,
        volumeBreaks = srcItem.volumeBreaks,
        metadata = srcItem.metadata,
      }
      table.insert(target.items, copy)
    end
  end

  if source.promoCodes ~= nil then
    for _, code in ipairs(source.promoCodes) do
      local already = false
      for _, existingCode in ipairs(target.promoCodes) do
        if existingCode == code then
          already = true
          break
        end
      end
      if not already then
        table.insert(target.promoCodes, code)
      end
    end
  end
end

computeTotals(target)
target.version = target.version + 1
target.updatedAt = nowIso
target.expiresAt = expiresAtIso

local encoded = cjson.encode(target)
redis.call('SET', targetKey, encoded, 'EX', ttl)
redis.call('DEL', sourceKey)
emitEvent(target)

return { 'ok', tostring(target.version), encoded }
