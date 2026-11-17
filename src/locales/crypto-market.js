const en = {
  title: 'Crypto Markets',
  kicker: 'Market data',
  subtitle: 'Live prices and personal watchlist for spot crypto markets.',
  refresh: 'Refresh',
  searchPlaceholder: 'Search a crypto pair, for example SOL/USDT',
  hot: 'Hot markets',
  watchlist: 'My watchlist',
  symbol: 'Pair',
  price: 'Last price',
  change: '24h change',
  action: 'Action',
  add: 'Add',
  remove: 'Remove',
  notAvailable: 'Unavailable',
  selectHint: 'Select a pair to view its live chart',
  updated: 'Updated',
  loadFailed: 'Failed to load market data',
  searchFailed: 'Search failed',
  actionFailed: 'Watchlist action failed',
  added: 'Added to watchlist'
}

const zh = {
  title: '加密行情',
  kicker: '市场数据',
  subtitle: '查看加密货币实时行情并管理自选列表。',
  refresh: '刷新',
  searchPlaceholder: '搜索加密交易对，例如 SOL/USDT',
  hot: '热门行情',
  watchlist: '我的自选',
  symbol: '交易对',
  price: '最新价',
  change: '24 小时涨跌',
  action: '操作',
  add: '加入自选',
  remove: '移除',
  notAvailable: '暂无数据',
  selectHint: '选择交易对查看实时 K 线',
  updated: '更新时间',
  loadFailed: '行情加载失败',
  searchFailed: '搜索失败',
  actionFailed: '自选操作失败',
  added: '已加入自选'
}

const prefix = obj => Object.fromEntries(Object.entries(obj).map(([key, value]) => [`cryptoMarket.${key}`, value]))

export default {
  'en-US': prefix(en),
  'zh-CN': prefix(zh),
  'zh-TW': prefix(zh)
}
