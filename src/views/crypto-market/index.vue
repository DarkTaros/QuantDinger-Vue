<template>
  <div class="crypto-market-page">
    <div class="page-header">
      <div>
        <div class="eyebrow">{{ $t('cryptoMarket.kicker') }}</div>
        <h1>{{ $t('cryptoMarket.title') }}</h1>
        <p>{{ $t('cryptoMarket.subtitle') }}</p>
      </div>
      <a-button icon="reload" :loading="loading" @click="loadAll">{{ $t('cryptoMarket.refresh') }}</a-button>
    </div>

    <div class="market-toolbar">
      <a-input-search
        v-model="keyword"
        allow-clear
        enter-button
        :placeholder="$t('cryptoMarket.searchPlaceholder')"
        @search="searchAssets"
      />
      <a-select v-model="timeframe" size="small" class="timeframe-select">
        <a-select-option v-for="item in timeframes" :key="item" :value="item">{{ item }}</a-select-option>
      </a-select>
      <span class="updated">{{ $t('cryptoMarket.updated') }} {{ updatedAt || '—' }}</span>
    </div>

    <a-alert v-if="error" type="warning" show-icon :message="error" class="page-alert" />

    <div class="market-grid">
      <a-card class="quotes-card" :bordered="false">
        <a-tabs v-model="activeTab" @change="onTabChange">
          <a-tab-pane key="hot" :tab="$t('cryptoMarket.hot')" />
          <a-tab-pane key="watchlist" :tab="`${$t('cryptoMarket.watchlist')} (${watchlist.length})`" />
        </a-tabs>
        <a-table
          :columns="columns"
          :data-source="activeRows"
          :loading="loading"
          :pagination="{ pageSize: 12, hideOnSinglePage: true }"
          row-key="rowKey"
          size="middle"
          @rowClick="selectRow"
        >
          <template slot="symbol" slot-scope="value, row">
            <button class="symbol-button" type="button" @click.stop="selectRow(row)">
              <strong>{{ value }}</strong>
              <span>{{ row.name || 'Crypto' }}</span>
            </button>
          </template>
          <template slot="price" slot-scope="value, row">
            <span v-if="row.price > 0" class="price">{{ formatPrice(row.price) }}</span>
            <span v-else class="muted">—</span>
          </template>
          <template slot="changePercent" slot-scope="value">
            <span :class="changeClass(value)">{{ formatChange(value) }}</span>
          </template>
          <template slot="action" slot-scope="_, row">
            <a-button
              v-if="row.watched"
              type="link"
              size="small"
              @click.stop="remove(row)"
            >{{ $t('cryptoMarket.remove') }}</a-button>
            <a-button
              v-else-if="row.asset_id"
              type="link"
              size="small"
              @click.stop="add(row)"
            >{{ $t('cryptoMarket.add') }}</a-button>
            <span v-else class="muted">{{ $t('cryptoMarket.notAvailable') }}</span>
          </template>
        </a-table>
      </a-card>

      <a-card v-if="selected" class="chart-card" :bordered="false" :title="selected.symbol">
        <div class="chart-meta">
          <span>{{ selected.exchange_id || 'BINANCE' }} · Spot</span>
          <span v-if="selected.price > 0" class="price">{{ formatPrice(selected.price) }}</span>
        </div>
        <realtime-kline-chart
          :exchange="selected.exchange_id || 'binance'"
          :symbol="selected.symbol"
          :timeframe="timeframe"
          :window-hours="4"
          :height="380"
        />
      </a-card>
      <a-card v-else class="chart-card empty-card" :bordered="false">
        <a-empty :description="$t('cryptoMarket.selectHint')" />
      </a-card>
    </div>
  </div>
</template>

<script>
import moment from 'moment'
import { addWatchlist, getHotSymbols, getMarketPrice, getWatchlist, getWatchlistPrices, removeWatchlist, searchAssets as searchMarketAssets } from '@/api/market'
import RealtimeKlineChart from '@/views/arbitrage/RealtimeKlineChart.vue'

export default {
  name: 'CryptoMarket',
  components: { RealtimeKlineChart },
  data () {
    return {
      activeTab: 'hot',
      keyword: '',
      timeframe: '1m',
      timeframes: ['1m', '5m', '15m', '1H'],
      loading: false,
      error: '',
      updatedAt: '',
      hotRows: [],
      searchRows: [],
      watchlist: [],
      watchlistPrices: [],
      selected: null
    }
  },
  computed: {
    columns () {
      return [
        { title: this.$t('cryptoMarket.symbol'), dataIndex: 'symbol', scopedSlots: { customRender: 'symbol' } },
        { title: this.$t('cryptoMarket.price'), dataIndex: 'price', scopedSlots: { customRender: 'price' } },
        { title: this.$t('cryptoMarket.change'), dataIndex: 'changePercent', scopedSlots: { customRender: 'changePercent' } },
        { title: this.$t('cryptoMarket.action'), dataIndex: 'action', scopedSlots: { customRender: 'action' } }
      ]
    },
    activeRows () {
      if (this.activeTab === 'watchlist') return this.watchRows
      return this.keyword ? this.searchRows : this.hotRows
    },
    watchRows () {
      const priceByAsset = (this.watchlistPrices || []).reduce((map, item) => {
        map[`${item.asset_id || ''}:${item.symbol || ''}`] = item
        return map
      }, {})
      return (this.watchlist || []).map(item => {
        const quote = priceByAsset[`${item.asset_id || ''}:${item.symbol || ''}`] || {}
        return this.normalizeRow({ ...item, ...quote, watched: true, asset_id: item.asset_id })
      })
    }
  },
  async created () {
    await this.loadAll()
  },
  methods: {
    normalizeRow (item) {
      return {
        ...item,
        rowKey: `${item.asset_id || item.symbol || ''}:${item.exchange_id || ''}`,
        symbol: String(item.symbol || '').toUpperCase(),
        price: Number(item.price || 0),
        changePercent: Number(item.changePercent || 0),
        watched: Boolean(item.watched)
      }
    },
    async loadAll () {
      this.loading = true
      this.error = ''
      try {
        const [hotResponse, watchResponse, pricesResponse] = await Promise.all([
          getHotSymbols({ market: 'Crypto', limit: 30 }),
          getWatchlist({ market: 'Crypto' }),
          getWatchlistPrices()
        ])
        this.watchlist = watchResponse && watchResponse.data ? watchResponse.data : []
        this.watchlistPrices = pricesResponse && pricesResponse.data ? pricesResponse.data : []
        const hot = hotResponse && hotResponse.data ? hotResponse.data : []
        this.hotRows = await this.withPrices(hot)
        this.updatedAt = moment().format('HH:mm:ss')
        if (this.selected) {
          const next = this.activeRows.find(row => row.symbol === this.selected.symbol)
          if (next) this.selected = next
        }
      } catch (error) {
        this.error = error.message || this.$t('cryptoMarket.loadFailed')
      } finally {
        this.loading = false
      }
    },
    async withPrices (items) {
      return Promise.all((items || []).map(async item => {
        try {
          const response = await getMarketPrice({
            market: 'Crypto',
            symbol: item.symbol,
            exchange_id: item.exchange_id || 'binance',
            market_type: item.market_type || 'spot',
            instrument_id: item.instrument_id || ''
          })
          return this.normalizeRow({ ...item, ...(response && response.data ? response.data : {}) })
        } catch (_) {
          return this.normalizeRow(item)
        }
      }))
    },
    async searchAssets () {
      const keyword = String(this.keyword || '').trim()
      if (!keyword) {
        this.searchRows = []
        return
      }
      this.loading = true
      try {
        const response = await searchMarketAssets({ market: 'Crypto', keyword, limit: 30 })
        this.searchRows = await this.withPrices(response && response.data ? response.data : [])
      } catch (error) {
        this.error = error.message || this.$t('cryptoMarket.searchFailed')
      } finally {
        this.loading = false
      }
    },
    onTabChange (tab) {
      if (tab === 'watchlist' && !this.watchlist.length) this.selected = null
    },
    selectRow (row) {
      this.selected = row
    },
    async add (row) {
      try {
        await addWatchlist({ asset_id: row.asset_id })
        await this.loadAll()
        this.$message.success(this.$t('cryptoMarket.added'))
      } catch (error) {
        this.error = error.message || this.$t('cryptoMarket.actionFailed')
      }
    },
    async remove (row) {
      try {
        await removeWatchlist({ asset_id: row.asset_id })
        await this.loadAll()
        if (this.selected && this.selected.asset_id === row.asset_id) this.selected = null
      } catch (error) {
        this.error = error.message || this.$t('cryptoMarket.actionFailed')
      }
    },
    formatPrice (value) {
      const number = Number(value)
      if (!Number.isFinite(number) || number <= 0) return '—'
      return number >= 1 ? number.toLocaleString(undefined, { maximumFractionDigits: 4 }) : number.toPrecision(5)
    },
    formatChange (value) {
      const number = Number(value)
      return Number.isFinite(number) ? `${number >= 0 ? '+' : ''}${number.toFixed(2)}%` : '—'
    },
    changeClass (value) {
      const number = Number(value)
      return number > 0 ? 'positive' : number < 0 ? 'negative' : 'muted'
    }
  }
}
</script>

<style scoped>
.crypto-market-page { min-height: 100%; padding: 24px; background: #f7f8f6; color: #253247; }
.page-header, .market-toolbar, .chart-meta { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.page-header { margin-bottom: 18px; }
.page-header h1 { margin: 4px 0; color: #253247; }
.page-header p { margin: 0; color: #7a8494; }
.eyebrow { color: #52c41a; font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.market-toolbar { justify-content: flex-start; padding: 12px; margin-bottom: 14px; background: #fff; border: 1px solid #e6eaf0; border-radius: 8px; }
.market-toolbar .ant-input-search { max-width: 360px; }
.timeframe-select { width: 90px; }
.updated { margin-left: auto; color: #98a2b3; font-size: 12px; }
.page-alert { margin-bottom: 14px; }
.market-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(360px, .9fr); gap: 16px; }
.quotes-card, .chart-card { border: 1px solid #e6eaf0; border-radius: 8px; }
.chart-card { min-height: 480px; }
.empty-card { display: flex; align-items: center; justify-content: center; }
.symbol-button { display: flex; flex-direction: column; align-items: flex-start; padding: 0; border: 0; background: none; color: #253247; cursor: pointer; }
.symbol-button span { margin-top: 2px; color: #98a2b3; font-size: 12px; }
.price { color: #253247; font-variant-numeric: tabular-nums; font-weight: 600; }
.positive { color: #52c41a; font-variant-numeric: tabular-nums; }
.negative { color: #ff4d4f; font-variant-numeric: tabular-nums; }
.muted { color: #98a2b3; }
.chart-meta { margin-bottom: 8px; color: #7a8494; font-size: 12px; }
@media (max-width: 1100px) { .market-grid { grid-template-columns: 1fr; } .chart-card { min-height: 400px; } }
</style>
