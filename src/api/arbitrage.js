import request from '@/utils/request'

export function arbitrageRequest (path, method = 'get', data, key) {
  return request({
    url: `/api/arbitrage${path}`,
    method,
    ...(method === 'get' ? { params: data } : { data }),
    ...(key ? { headers: { 'Idempotency-Key': key } } : {})
  })
}

export function arbitrageUpload (path, formData, key) {
  return request({
    url: `/api/arbitrage${path}`,
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(key ? { 'Idempotency-Key': key } : {})
    }
  })
}

export function getArbitrageFeeRates (params = {}) {
  return arbitrageRequest('/fee-rates', 'get', params)
}
