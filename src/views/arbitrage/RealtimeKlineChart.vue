<template>
  <div class="realtime-kline">
    <div ref="container" class="kline-canvas" :style="{ height: `${height}px` }" />
    <div v-if="loading" class="kline-state">{{ $t('arbitrage.marketLoading') }}</div>
    <div v-else-if="error" class="kline-state error">{{ $t('arbitrage.marketUnavailable') }}</div>
  </div>
</template>

<script>
import { dispose, init } from 'klinecharts'
import ExchangeKlineWs from '@/utils/exchangeWs'

function compactSymbol (symbol) {
  return String(symbol || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

function timeframeMinutes (timeframe) {
  const value = String(timeframe || '1m').toUpperCase()
  if (value.endsWith('H')) return Number(value.slice(0, -1)) * 60
  if (value.endsWith('D')) return Number(value.slice(0, -1)) * 1440
  return Number(value.replace('M', '')) || 1
}

function normalizeBar (row) {
  return {
    timestamp: Number(row.timestamp),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume || 0)
  }
}

export default {
  name: 'RealtimeKlineChart',
  props: {
    exchange: { type: String, required: true },
    symbol: { type: String, required: true },
    timeframe: { type: String, default: '1m' },
    windowHours: { type: Number, default: 4 },
    height: { type: Number, default: 280 }
  },
  data () {
    return { chart: null, stream: null, bars: [], loading: false, error: false, resizeObserver: null }
  },
  watch: {
    exchange: 'restart',
    symbol: 'restart',
    timeframe: 'restart'
  },
  mounted () {
    this.createChart()
    this.restart()
  },
  beforeDestroy () {
    this.stopStream()
    if (this.resizeObserver) this.resizeObserver.disconnect()
    if (this.chart) dispose(this.chart)
  },
  methods: {
    createChart () {
      if (!this.$refs.container || this.chart) return
      this.chart = init(this.$refs.container)
      this.chart.setStyles({
        grid: { horizontal: { color: '#eef1f5' }, vertical: { color: '#f5f6f8' } },
        candle: {
          type: 'candle_solid',
          bar: { upColor: '#52c41a', downColor: '#ff4d4f', noChangeColor: '#98a2b3' },
          priceMark: { high: { color: '#98a2b3' }, low: { color: '#98a2b3' } },
          tooltip: { text: { color: '#253247' } }
        },
        xAxis: { axisLine: { color: '#dfe4ea' }, tickLine: { color: '#dfe4ea' }, tickText: { color: '#7a8494' } },
        yAxis: { axisLine: { color: '#dfe4ea' }, tickLine: { color: '#dfe4ea' }, tickText: { color: '#7a8494' } },
        separator: { color: '#eef1f5' },
        crosshair: { horizontal: { line: { color: '#aab4c2' }, text: { backgroundColor: '#253247' } }, vertical: { line: { color: '#aab4c2' }, text: { backgroundColor: '#253247' } } }
      })
      this.chart.setPriceVolumePrecision(2, 4)
      try { this.chart.createIndicator('VOL', false, { height: 64 }) } catch (_) {}
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.chart && this.chart.resize())
        this.resizeObserver.observe(this.$refs.container)
      }
    },
    restart () {
      this.stopStream()
      this.bars = []
      this.error = false
      this.loading = true
      if (this.chart) this.chart.applyNewData([])
      this.loadHistory().finally(() => this.connectStream())
    },
    stopStream () {
      if (this.stream) this.stream.disconnect()
      this.stream = null
    },
    async loadHistory () {
      const limit = Math.min(1000, Math.max(60, Math.ceil(this.windowHours * 60 / timeframeMinutes(this.timeframe))))
      const pair = compactSymbol(this.symbol)
      try {
        let rows = []
        if (this.exchange.toLowerCase() === 'binance') {
          const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${this.binanceInterval()}&limit=${limit}`)
          if (!response.ok) throw new Error('BINANCE_KLINE_HTTP')
          rows = (await response.json()).map(item => ({ timestamp: item[0], open: item[1], high: item[2], low: item[3], close: item[4], volume: item[5] }))
        } else {
          const response = await fetch(`https://www.okx.com/api/v5/market/candles?instId=${this.okxSymbol()}&bar=${this.okxInterval()}&limit=${Math.min(limit, 300)}`)
          if (!response.ok) throw new Error('OKX_KLINE_HTTP')
          const payload = await response.json()
          rows = (payload.data || []).map(item => ({ timestamp: item[0], open: item[1], high: item[2], low: item[3], close: item[4], volume: item[5] })).reverse()
        }
        this.bars = rows.map(normalizeBar).filter(this.validBar).sort((a, b) => a.timestamp - b.timestamp)
        if (this.chart && this.bars.length) this.chart.applyNewData(this.bars)
      } catch (_) {
        this.error = true
      } finally {
        this.loading = false
      }
    },
    validBar (bar) {
      return bar.timestamp > 0 && [bar.open, bar.high, bar.low, bar.close].every(value => Number.isFinite(value))
    },
    binanceInterval () {
      return ({ '1m': '1m', '5m': '5m', '15m': '15m', '1H': '1h' })[this.timeframe] || '1m'
    },
    okxInterval () {
      return ({ '1m': '1m', '5m': '5m', '15m': '15m', '1H': '1H' })[this.timeframe] || '1m'
    },
    okxSymbol () {
      const raw = String(this.symbol || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      return raw.endsWith('USDT') ? `${raw.slice(0, -4)}-USDT` : raw.replace(/([A-Z]+)(USDT)$/, '$1-$2')
    },
    connectStream () {
      this.stream = new ExchangeKlineWs()
      this.stream.connect(this.symbol, this.timeframe, {
        onTick: bar => this.applyBar(bar),
        onNewBar: bar => this.applyBar(bar),
        onError: () => { this.error = true },
        onReconnecting: () => { this.$emit('status', { exchange: this.exchange, status: 'reconnecting' }) },
        onReconnected: () => { this.$emit('status', { exchange: this.exchange, status: 'live' }) }
      }, this.exchange, { marketType: 'spot' })
      this.$emit('status', { exchange: this.exchange, status: 'connecting' })
    },
    applyBar (raw) {
      const bar = normalizeBar(raw)
      if (!this.validBar(bar)) return
      this.error = false
      const last = this.bars[this.bars.length - 1]
      if (!last || bar.timestamp > last.timestamp) this.bars.push(bar)
      else if (bar.timestamp === last.timestamp) this.$set(this.bars, this.bars.length - 1, bar)
      else return
      this.bars = this.bars.slice(-1000)
      if (!this.chart) return
      try { this.chart.updateData(bar) } catch (_) { this.chart.applyNewData(this.bars) }
      this.$emit('bar', { exchange: this.exchange, bar })
    }
  }
}
</script>

<style scoped>
.realtime-kline { position: relative; min-height: 180px; background: #fff; }
.kline-canvas { width: 100%; }
.kline-state { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #98a2b3; font-size: 12px; background: rgba(255, 255, 255, .82); }
.kline-state.error { color: #ff4d4f; }
</style>
