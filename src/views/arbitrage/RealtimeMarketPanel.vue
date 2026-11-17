<template>
  <div class="realtime-market-panel">
    <div class="market-toolbar">
      <div class="toolbar-title"><span class="live-dot" :class="overallStatus" /> {{ $t('arbitrage.liveMarket') }}</div>
      <a-radio-group v-model="localTimeframe" size="small" button-style="solid">
        <a-radio-button v-for="value in timeframes" :key="value" :value="value">{{ value }}</a-radio-button>
      </a-radio-group>
      <span class="toolbar-note">{{ $t('arbitrage.publicMarketData') }} · {{ $t('arbitrage.updatedAt') }} {{ updatedAt }}</span>
    </div>

    <div class="market-summary-grid">
      <a-card size="small" class="opportunity-card" :class="bestOpportunity.tone">
        <div class="summary-label">{{ $t('arbitrage.bestNetOpportunity') }}</div>
        <div class="summary-value">{{ formatBps(bestOpportunity.netBps) }}</div>
        <div class="summary-note">{{ bestOpportunity.label }} · {{ formatQuote(bestOpportunity.netQuote) }} USDT / {{ $t('arbitrage.notional') }} {{ notional }} USDT</div>
      </a-card>
      <a-card v-for="item in directionRows" :key="item.key" size="small" class="direction-card">
        <div class="direction-heading"><span>{{ item.label }}</span><a-tag :color="item.netBps > 0 ? 'green' : 'default'">{{ formatBps(item.netBps) }}</a-tag></div>
        <div class="direction-line"><span>{{ $t('arbitrage.grossSpread') }}</span><strong>{{ formatBps(item.grossBps) }}</strong></div>
        <div class="direction-line muted"><span>{{ $t('arbitrage.feeEstimate') }}</span><span>{{ formatFeeBps(item.feeBps) }}</span></div>
        <div class="direction-line muted"><span>{{ $t('arbitrage.feeRatePair') }}</span><span>M {{ formatFeeBps(item.makerFeeBps) }} / T {{ formatFeeBps(item.feeBps) }}</span></div>
      </a-card>
    </div>

    <div class="venue-grid">
      <a-card v-for="venue in venues" :key="venue.id" size="small" class="venue-card">
        <template slot="title"><span class="venue-title"><span class="venue-dot" :class="venue.id" /> {{ venue.label }}</span></template>
        <template slot="extra"><a-tag :color="statusColor(states[venue.id])">{{ statusLabel(states[venue.id]) }}</a-tag></template>
        <div class="book-grid">
          <div><div class="book-label">{{ $t('arbitrage.bestBid') }}</div><div class="book-price bid">{{ formatPrice(books[venue.id].best_bid) }}</div></div>
          <div><div class="book-label">{{ $t('arbitrage.bestAsk') }}</div><div class="book-price ask">{{ formatPrice(books[venue.id].best_ask) }}</div></div>
          <div><div class="book-label">{{ $t('arbitrage.midPrice') }}</div><div class="book-price">{{ formatPrice(mid(books[venue.id])) }}</div></div>
          <div><div class="book-label">{{ $t('arbitrage.quoteAge') }}</div><div class="book-price age">{{ age(books[venue.id]) }}</div></div>
        </div>
        <realtime-kline-chart :exchange="venue.id" :symbol="symbol" :timeframe="localTimeframe" :window-hours="windowHours" @status="onChartStatus" />
      </a-card>
    </div>

    <a-alert v-if="qualityWarning" type="warning" show-icon :message="qualityWarning" class="quality-alert" />
  </div>
</template>

<script>
import ExchangeOrderBookWs from '@/utils/exchangeOrderBookWs'
import RealtimeKlineChart from './RealtimeKlineChart.vue'

const EMPTY_BOOK = { best_bid: null, best_ask: null, timestamp: 0, received_at: 0 }

export default {
  name: 'RealtimeMarketPanel',
  components: { RealtimeKlineChart },
  props: {
    symbol: { type: String, required: true },
    timeframe: { type: String, default: '1m' },
    feeBps: { type: Number, default: 10 },
    feeRates: { type: Object, default: () => ({}) },
    notional: { type: Number, default: 100 },
    windowHours: { type: Number, default: 4 }
  },
  data () {
    return {
      localTimeframe: this.timeframe,
      timeframes: ['1m', '5m', '15m', '1H'],
      venues: [{ id: 'binance', label: 'Binance Spot' }, { id: 'okx', label: 'OKX Spot' }],
      books: { binance: { ...EMPTY_BOOK }, okx: { ...EMPTY_BOOK } },
      states: { binance: 'connecting', okx: 'connecting' },
      streams: {},
      updatedAt: '—',
      clockTimer: null
    }
  },
  computed: {
    overallStatus () {
      return Object.values(this.states).every(value => value === 'live') ? 'live' : 'connecting'
    },
    feeRate () { return Math.max(0, Number(this.feeBps) || 0) },
    venueFeeRates () {
      const configured = this.feeRates && typeof this.feeRates === 'object' ? this.feeRates : {}
      const fallback = this.feeRate
      const read = (entry, key, fallbackValue) => Number.isFinite(Number(entry && entry[key])) ? Math.max(0, Number(entry[key])) : fallbackValue
      const binance = configured.binance || configured.BINANCE || {}
      const okx = configured.okx || configured.OKX || {}
      return {
        binance: { maker: read(binance, 'makerFeeBps', read(binance, 'fallbackTakerFeeBps', fallback)), taker: read(binance, 'takerFeeBps', read(binance, 'fallbackTakerFeeBps', fallback)) },
        okx: { maker: read(okx, 'makerFeeBps', read(okx, 'fallbackTakerFeeBps', fallback)), taker: read(okx, 'takerFeeBps', read(okx, 'fallbackTakerFeeBps', fallback)) }
      }
    },
    directionRows () {
      const b = this.books.binance
      const o = this.books.okx
      return [
        this.direction('buy_binance_sell_okx', 'Binance 买入 → OKX 卖出', b.best_ask, o.best_bid, this.venueFeeRates.binance.taker + this.venueFeeRates.okx.taker, this.venueFeeRates.binance.maker + this.venueFeeRates.okx.maker),
        this.direction('buy_okx_sell_binance', 'OKX 买入 → Binance 卖出', o.best_ask, b.best_bid, this.venueFeeRates.okx.taker + this.venueFeeRates.binance.taker, this.venueFeeRates.okx.maker + this.venueFeeRates.binance.maker)
      ]
    },
    bestOpportunity () {
      const rows = this.directionRows.filter(item => Number.isFinite(item.netBps))
      if (!rows.length) return { netBps: null, netQuote: null, label: '—', tone: 'empty' }
      const row = rows.reduce((best, item) => item.netBps > best.netBps ? item : best, rows[0])
      return { ...row, tone: row.netBps > 0 ? 'positive' : 'negative' }
    },
    qualityWarning () {
      const b = this.books.binance
      const o = this.books.okx
      if (!b.received_at || !o.received_at) return this.$t('arbitrage.waitingForQuotes')
      if (Math.abs(b.received_at - o.received_at) > 2000) return this.$t('arbitrage.marketTimestampsDiverged')
      if (this.age(b, true) > 5000 || this.age(o, true) > 5000) return this.$t('arbitrage.quotesStale')
      return ''
    }
  },
  watch: {
    symbol: 'restart',
    timeframe (value) { this.localTimeframe = value; this.restart() },
    localTimeframe (value, previous) { if (previous && value !== previous) this.$emit('timeframe-change', value) }
  },
  mounted () {
    this.startStreams()
    this.clockTimer = setInterval(() => { this.updatedAt = this.formatTime(Date.now()) }, 1000)
  },
  beforeDestroy () {
    this.stopStreams()
    clearInterval(this.clockTimer)
  },
  methods: {
    restart () { this.stopStreams(); this.books = { binance: { ...EMPTY_BOOK }, okx: { ...EMPTY_BOOK } }; this.startStreams() },
    startStreams () {
      this.venues.forEach(venue => {
        const stream = new ExchangeOrderBookWs()
        this.streams[venue.id] = stream
        stream.connect(this.symbol, {
          onSnapshot: snapshot => {
            this.$set(this.books, venue.id, snapshot)
            this.$set(this.states, venue.id, 'live')
            this.updatedAt = this.formatTime(Date.now())
            this.$emit('snapshot', { venue: venue.id, snapshot })
          },
          onStatus: status => this.$set(this.states, venue.id, status),
          onFallback: () => this.$set(this.states, venue.id, 'reconnecting'),
          onUnavailable: () => this.$set(this.states, venue.id, 'unavailable')
        }, venue.id, { marketType: 'spot' })
      })
    },
    stopStreams () { Object.values(this.streams).forEach(stream => stream && stream.disconnect()); this.streams = {} },
    onChartStatus () {},
    direction (key, label, buy, sell, feeBps = this.feeRate * 2, makerFeeBps = this.feeRate * 2) {
      const grossBps = Number.isFinite(Number(buy)) && Number(buy) > 0 && Number.isFinite(Number(sell)) ? (Number(sell) - Number(buy)) / Number(buy) * 10000 : null
      const netBps = grossBps == null ? null : grossBps - feeBps
      return { key, label, grossBps, netBps, feeBps, makerFeeBps, netQuote: netBps == null ? null : this.notional * netBps / 10000 }
    },
    mid (book) { return book && Number.isFinite(Number(book.best_bid)) && Number.isFinite(Number(book.best_ask)) ? (Number(book.best_bid) + Number(book.best_ask)) / 2 : null },
    age (book, raw = false) { const value = book && book.received_at ? Math.max(0, Date.now() - Number(book.received_at)) : null; return raw ? (value == null ? Infinity : value) : value == null ? '—' : `${value} ms` },
    formatPrice (value) { const number = Number(value); return Number.isFinite(number) ? number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : '—' },
    formatBps (value) { const number = Number(value); return Number.isFinite(number) ? `${number >= 0 ? '+' : ''}${number.toFixed(2)} bps` : '—' },
    formatFeeBps (value) { const number = Number(value); return Number.isFinite(number) ? `${number.toFixed(2)} bps` : '—' },
    formatQuote (value) { const number = Number(value); return Number.isFinite(number) ? `${number >= 0 ? '+' : ''}${number.toFixed(4)}` : '—' },
    formatTime (timestamp) { return new Date(timestamp).toISOString().slice(11, 19) },
    statusColor (value) { return value === 'live' ? 'green' : value === 'unavailable' ? 'red' : 'orange' },
    statusLabel (value) { return value === 'live' ? this.$t('arbitrage.live') : value === 'unavailable' ? this.$t('arbitrage.unavailable') : this.$t('arbitrage.reconnecting') }
  }
}
</script>

<style scoped>
.realtime-market-panel { margin-top: 14px; }
.market-toolbar { display: flex; align-items: center; gap: 14px; padding: 10px 12px; margin-bottom: 12px; border: 1px solid #e6eaf0; border-radius: 6px; background: #fff; }
.toolbar-title { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #253247; }
.toolbar-note { margin-left: auto; color: #98a2b3; font-size: 12px; }
.live-dot, .venue-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; background: #f5a623; }
.live-dot.live { background: #52c41a; box-shadow: 0 0 0 3px rgba(82, 196, 26, .14); }
.live-dot.connecting { animation: pulse 1.2s infinite; }
.market-summary-grid { display: grid; grid-template-columns: 1.15fr 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.opportunity-card, .direction-card, .venue-card { border-color: #e6eaf0; }
.opportunity-card.positive { border-color: #b7eb8f; background: #f6ffed; }
.opportunity-card.negative { border-color: #ffccc7; background: #fff2f0; }
.summary-label, .book-label { color: #7a8494; font-size: 12px; }
.summary-value { margin-top: 6px; color: #253247; font-size: 27px; font-weight: 700; }
.positive .summary-value { color: #389e0d; }.negative .summary-value { color: #cf1322; }
.summary-note { margin-top: 4px; color: #7a8494; font-size: 12px; }
.direction-heading, .direction-line { display: flex; justify-content: space-between; align-items: center; }.direction-heading { color: #253247; font-weight: 600; }.direction-line { margin-top: 10px; color: #253247; font-size: 12px; }.direction-line.muted { color: #98a2b3; margin-top: 4px; }
.venue-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }.venue-title { display: inline-flex; align-items: center; gap: 8px; }.venue-dot.binance { background: #f0b90b; }.venue-dot.okx { background: #253247; }
.book-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 0 0 10px; border-bottom: 1px solid #eef1f5; }.book-price { margin-top: 5px; color: #253247; font-size: 14px; font-weight: 600; }.book-price.bid { color: #389e0d; }.book-price.ask { color: #cf1322; }.book-price.age { color: #7a8494; font-size: 12px; font-weight: 400; }
.quality-alert { margin-top: 12px; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
@media (max-width: 1050px) { .market-summary-grid, .venue-grid { grid-template-columns: 1fr; } .toolbar-note { display: none; } }
</style>
