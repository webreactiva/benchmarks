/**
 * Lua scripts executed atomically by Redis.
 *
 * Every mutation of a cart is a compare-and-set on the cart version. Running
 * it server side removes the read/modify/write race that a naive
 * `GET` + `SET` pair would have, and keeps the round trip to a single command.
 */

/**
 * KEYS[1] cart key
 * ARGV[1] expected version
 * ARGV[2] new cart payload (already containing the incremented version)
 * ARGV[3] ttl in seconds
 * -> {'ok', newVersion} | {'conflict', currentVersion} | {'not_found', ''} | {'corrupt', ''}
 */
export const SAVE_CART_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if not current then
  return {'not_found', ''}
end
local ok, decoded = pcall(cjson.decode, current)
if not ok or type(decoded) ~= 'table' then
  return {'corrupt', ''}
end
if tonumber(decoded['version']) ~= tonumber(ARGV[1]) then
  return {'conflict', tostring(decoded['version'])}
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return {'ok', tostring(tonumber(ARGV[1]) + 1)}
`;

/**
 * KEYS[1] cart key
 * ARGV[1] cart payload
 * ARGV[2] ttl in seconds
 * -> {'ok', ''} | {'exists', ''}
 */
export const CREATE_CART_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  return {'exists', ''}
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
return {'ok', ''}
`;

/**
 * KEYS[1..n] stock keys, KEYS[n+1] reservation key
 * ARGV[1] reservation id
 * ARGV[2] ttl seconds
 * ARGV[3] items json [{productId, quantity}]
 * -> {'ok', reservationId} | {'insufficient', productId, available}
 */
export const RESERVE_STOCK_SCRIPT = `
local stockCount = #KEYS - 1
local items = cjson.decode(ARGV[3])
for index = 1, stockCount do
  local item = items[index]
  local available = tonumber(redis.call('GET', KEYS[index]) or '0')
  if available < tonumber(item['quantity']) then
    return {'insufficient', item['productId'], tostring(available)}
  end
end
for index = 1, stockCount do
  local item = items[index]
  redis.call('DECRBY', KEYS[index], tonumber(item['quantity']))
end
redis.call('SET', KEYS[stockCount + 1], ARGV[3], 'EX', ARGV[2])
return {'ok', ARGV[1]}
`;

/**
 * KEYS[1] reservation key, KEYS[2..n] stock keys
 * -> 'ok'
 */
export const RELEASE_STOCK_SCRIPT = `
local payload = redis.call('GET', KEYS[1])
if not payload then
  return 'missing'
end
local items = cjson.decode(payload)
for index = 1, #items do
  local item = items[index]
  redis.call('INCRBY', KEYS[index + 1], tonumber(item['quantity']))
end
redis.call('DEL', KEYS[1])
return 'ok'
`;

/**
 * Atomically claims an idempotency key.
 * KEYS[1] idempotency key
 * ARGV[1] request hash
 * ARGV[2] placeholder record (JSON)
 * ARGV[3] ttl seconds
 * -> {'claimed', ''} | {'replay', storedRecord} | {'conflict', storedRecord}
 */
export const CLAIM_IDEMPOTENCY_SCRIPT = `
local existing = redis.call('GET', KEYS[1])
if not existing then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
  return {'claimed', ''}
end
local ok, decoded = pcall(cjson.decode, existing)
if not ok or type(decoded) ~= 'table' then
  return {'conflict', existing}
end
if decoded['requestHash'] == ARGV[1] then
  return {'replay', existing}
end
return {'conflict', existing}
`;
