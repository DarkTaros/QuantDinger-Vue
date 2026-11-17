<template>
  <div class="arbitrage-workspace">
    <div class="workspace-heading">
      <div><div class="eyebrow">{{ $t('arbitrage.subtitle') }}</div><h1>{{ $t('arbitrage.title') }}</h1></div>
      <div class="heading-actions"><a-tag color="green">{{ $t('arbitrage.paperNoticeShort') }}</a-tag><a-button icon="reload" :loading="loading" @click="refresh">{{ $t('arbitrage.refresh') }}</a-button></div>
    </div>
    <a-alert
      v-if="error"
      type="error"
      show-icon
      closable
      :message="error"
      @close="error = ''" />
    <a-tabs v-model="tab" class="arbitrage-tabs">
      <a-tab-pane key="monitor" :tab="$t('arbitrage.monitor')">
        <div class="toolbar-row">
          <a-select v-model="pair" class="pair-select" @change="setPair"><a-select-option v-for="p in pairs" :key="p" :value="p">{{ p }}</a-select-option></a-select>
          <a-select v-model="selectedCredentialIds.BINANCE" allow-clear class="credential-select" :placeholder="$t('arbitrage.selectBinanceAccount')" @change="refreshFeeRates(true, true)">
            <a-select-option v-for="item in binanceCredentials" :key="item.id" :value="item.id">{{ item.name || item.api_key_hint || `#${item.id}` }}</a-select-option>
          </a-select>
          <a-select v-model="selectedCredentialIds.OKX" allow-clear class="credential-select" :placeholder="$t('arbitrage.selectOkxAccount')" @change="refreshFeeRates(true, true)">
            <a-select-option v-for="item in okxCredentials" :key="item.id" :value="item.id">{{ item.name || item.api_key_hint || `#${item.id}` }}</a-select-option>
          </a-select>
          <a-button size="small" icon="sync" :loading="feeLoading" @click="refreshFeeRates(true, true)">{{ $t('arbitrage.refreshAccountFees') }}</a-button>
          <a-tag color="green"><a-icon type="check-circle" /> Binance Spot · {{ feeRateLabel('BINANCE') }}</a-tag>
          <a-tag color="green"><a-icon type="check-circle" /> OKX Spot · {{ feeRateLabel('OKX') }}</a-tag>
          <a-tag v-if="feeRateSource" :color="feeRateSource === 'account_api' ? 'green' : 'orange'">{{ feeRateSource === 'account_api' ? $t('arbitrage.accountFeeSource') : $t('arbitrage.manualFeeSource') }}</a-tag>
          <a-tag color="cyan">{{ $t('arbitrage.paper') }}</a-tag><span class="toolbar-spacer" /><span class="utc-label">UTC {{ nowLabel }}</span>
        </div>
        <realtime-market-panel
          :symbol="pair"
          :timeframe="monitorTimeframe"
          :fee-bps="monitorFeeBps"
          :fee-rates="monitorFeeRates"
          :window-hours="4"
          @timeframe-change="monitorTimeframe = $event" />
      </a-tab-pane>
      <a-tab-pane key="configure" :tab="$t('arbitrage.configure')">
        <div class="config-layout" v-if="config"><a-card class="config-card" :title="$t('arbitrage.backtestConfig')"><a-form layout="vertical"><a-form-item :label="$t('arbitrage.pair')"><a-select v-model="pair" @change="setPair"><a-select-option v-for="p in pairs" :key="p" :value="p">{{ p }}</a-select-option></a-select></a-form-item><a-form-item :label="$t('arbitrage.timeRangeUtc')"><a-range-picker
          v-model="rangeValue"
          show-time
          input-read-only
          format="YYYY-MM-DD HH:mm:ss"
          :placeholder="[$t('arbitrage.startPicker'), $t('arbitrage.endPicker')]"
          @change="onRangeChange" /></a-form-item><div class="preset-row"><a-button v-for="preset in presets" :key="preset.hours" size="small" :type="preset.hours === selectedPreset ? 'primary' : 'default'" @click="setPreset(preset.hours)">{{ preset.label }}</a-button></div><a-alert v-if="coverage && !coverage.complete" type="warning" show-icon :message="$t('arbitrage.datasetGapTitle')" :description="coverage.description" /><a-alert v-else-if="coverage" type="success" show-icon :message="$t('arbitrage.datasetReady')" :description="coverage.description" /><div v-if="coverage" class="coverage-strip"><span v-for="(segment, index) in coverage.segments" :key="index" :class="['coverage-segment', segment ? 'available' : 'missing']" /></div><div class="config-actions"><a-button v-if="coverage && !coverage.complete" type="primary" icon="download" :loading="submitting" @click="submitImport">{{ $t('arbitrage.downloadMissing') }}</a-button><a-upload :show-upload-list="false" :custom-request="uploadFiles" :multiple="true"><a-button icon="upload">{{ $t('arbitrage.uploadFiles') }}</a-button></a-upload><a-button type="primary" :disabled="!coverage || !coverage.complete" :loading="submitting" @click="submitRun('backtest')">{{ $t('arbitrage.submit') }}</a-button></div></a-form><config-fields :config.sync="config" /></a-card><a-card class="dataset-side-card" :title="$t('arbitrage.datasets')"><a-list size="small" :data-source="compatibleDatasets"><a-list-item slot="renderItem" slot-scope="item"><a-list-item-meta :title="item.id.slice(0, 12)" :description="`${item.start_at} → ${item.end_at}`" /><a-tag color="green">{{ $t('arbitrage.available') }}</a-tag></a-list-item></a-list><a-empty v-if="!compatibleDatasets.length" :description="$t('arbitrage.noDatasets')" /></a-card></div>
      </a-tab-pane>
      <a-tab-pane key="reports" :tab="$t('arbitrage.reports')"><a-table :columns="runColumns" :data-source="runs" row-key="id" :pagination="{ pageSize: 8 }"><template slot="status" slot-scope="value"><a-tag :color="statusColor(value)">{{ status(value) }}</a-tag></template><template slot="actions" slot-scope="_, row"><a-button type="link" @click="selectRun(row.id)">{{ $t('arbitrage.details') }}</a-button></template></a-table><div v-if="selected" class="report-shell"><div class="report-heading"><div><div class="eyebrow">{{ $t('arbitrage.backtestResult') }}</div><h2>{{ selected.config && selected.config.pair }} · {{ status(selected.status) }}</h2></div><div><a-button icon="reload" @click="rerun">{{ $t('arbitrage.rerun') }}</a-button><a-button type="primary" icon="download" @click="exportReport">{{ $t('arbitrage.exportReport') }}</a-button></div></div><a-alert v-if="selected.error" type="error" :message="selected.error" /><a-alert v-if="summary.pausedReason" type="warning" :message="$t('arbitrage.pausedReason')" :description="summary.pausedReason" /><div class="metric-grid report-metrics"><a-card v-for="key in reportMetrics" :key="key" size="small" class="metric-card"><div class="metric-label">{{ $t('arbitrage.' + key) }}</div><div class="metric-value">{{ summary[key] == null ? $t('arbitrage.unavailable') : summary[key] }}</div></a-card></div><div class="report-chart-grid"><a-card :title="$t('arbitrage.equityChart')"><series-chart :series="series.equity" :second-series="series.drawdown" second-color="#ff4d4f" unit="USDT" :empty-text="$t('arbitrage.seriesUnavailable')" /></a-card><a-card :title="$t('arbitrage.exposureChart')"><series-chart :series="series.exposure" unit="USDT" :empty-text="$t('arbitrage.seriesUnavailable')" /></a-card><a-card :title="$t('arbitrage.spreadDistribution')"><series-chart :series="series.spreadForward" :second-series="series.spreadReverse" type="bar" unit="bps" :empty-text="$t('arbitrage.seriesUnavailable')" /></a-card><a-card :title="$t('arbitrage.feeChart')"><series-chart :series="series.fees" type="bar" unit="USDT" :empty-text="$t('arbitrage.seriesUnavailable')" /></a-card></div><div class="report-detail-grid"><a-card :title="$t('arbitrage.cycles')"><a-table
        size="small"
        :columns="cycleColumns"
        :data-source="cycles"
        row-key="seq"
        :pagination="false"
        @rowClick="selectCycle"><template slot="state" slot-scope="value"><a-tag :color="value === 'completed' ? 'green' : 'orange'">{{ value }}</a-tag></template></a-table></a-card><a-card :title="$t('arbitrage.dataQuality')"><a-alert type="success" show-icon :message="$t('arbitrage.strictValidationPassed')" /><ul class="assumption-list"><li v-for="item in summary.assumptions || []" :key="item">{{ item }}</li></ul></a-card></div><a-drawer :title="$t('arbitrage.cycleDetails')" :visible="Boolean(selectedCycle)" width="480" @close="selectedCycle = null"><pre v-if="selectedCycle">{{ pretty(selectedCycle.body) }}</pre></a-drawer></div><a-empty v-else :description="$t('arbitrage.selection')" /></a-tab-pane>
      <a-tab-pane key="paper" :tab="$t('arbitrage.paper')"><a-card v-if="config" :title="$t('arbitrage.paper')"><a-alert :message="$t('arbitrage.paperNotice')" type="info" show-icon /><config-fields :config.sync="config" /><a-button type="primary" :disabled="paperRuns.some(r => active(r.status))" :loading="submitting" @click="submitRun('paper')">{{ $t('arbitrage.startPaper') }}</a-button></a-card></a-tab-pane>
      <a-tab-pane key="data" :tab="$t('arbitrage.data')"><a-card :title="$t('arbitrage.datasets')"><a-table :columns="datasetColumns" :data-source="datasets" row-key="id" :scroll="{ x: 900 }" /></a-card></a-tab-pane>
    </a-tabs><a-card v-if="job" size="small" class="task-card"><a-tag :color="statusColor(job.status)">{{ status(job.status) }}</a-tag> <span>{{ job.job_id }}</span><a-button v-if="active(job.status)" size="small" @click="cancel(job.job_id)">{{ $t('arbitrage.cancel') }}</a-button><pre v-if="job.progress">{{ pretty(job.progress) }}</pre></a-card>
  </div>
</template>

<script>
import moment from 'moment'
import { arbitrageRequest as api, arbitrageUpload, getArbitrageFeeRates } from '@/api/arbitrage'
import { listExchangeCredentials } from '@/api/credentials'
import ConfigFields from './ConfigFields.vue'
import SeriesChart from './SeriesChart.vue'
import RealtimeMarketPanel from './RealtimeMarketPanel.vue'

export default {
  components: { ConfigFields, SeriesChart, RealtimeMarketPanel },
  data () { const end = moment.utc().subtract(2, 'days').startOf('day'); return { tab: 'monitor', loading: false, feeLoading: false, feeRateFetchedAt: 0, submitting: false, error: '', pair: 'BTC/USDT', pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'], monitorTimeframe: '1m', config: null, credentials: [], selectedCredentialIds: { BINANCE: undefined, OKX: undefined }, feeRates: {}, rangeValue: [end.clone().subtract(24, 'hours'), end], start: end.clone().subtract(24, 'hours').toISOString(), end: end.toISOString(), selectedPreset: 24, presets: [{ hours: 24, label: '24h' }, { hours: 72, label: '3d' }, { hours: 168, label: '7d' }], templates: [], datasets: [], runs: [], selected: null, selectedCycle: null, cycles: [], job: null, timer: null, clockTimer: null, uploadTimer: null, uploadQueue: [], nowLabel: '', series: { equity: [], drawdown: [], exposure: [], fees: [], spreadForward: [], spreadReverse: [] }, monitorMetrics: [], reportMetrics: ['realizedProfit', 'equity', 'maxExposureQuote', 'completedCycles', 'partialFillRate', 'fees', 'inventoryHoldingPnl', 'inventoryAndOpenExposureRevaluation', 'compensationCashFlow'] } },
  computed: {
    summary () { return this.selected?.summary || {} },
    monitorFeeBps () {
      const venues = this.config && this.config.venues ? Object.values(this.config.venues) : []
      const values = venues.map(item => Number(item.takerFeeBps)).filter(Number.isFinite)
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 10
    },
    monitorFeeRates () {
      const venues = this.config && this.config.venues ? this.config.venues : {}
      return {
        BINANCE: { ...(this.feeRates.BINANCE || {}), fallbackTakerFeeBps: Number(venues.BINANCE && venues.BINANCE.takerFeeBps) },
        OKX: { ...(this.feeRates.OKX || {}), fallbackTakerFeeBps: Number(venues.OKX && venues.OKX.takerFeeBps) }
      }
    },
    binanceCredentials () { return this.credentials.filter(item => String(item.exchange_id || '').toLowerCase() === 'binance') },
    okxCredentials () { return this.credentials.filter(item => String(item.exchange_id || '').toLowerCase() === 'okx') },
    feeRateSource () {
      const values = Object.values(this.feeRates || {}).filter(Boolean)
      return values.length && values.every(item => item.available && item.source === 'account_api') ? 'account_api' : values.length ? 'configured' : ''
    },
paperRuns () { return this.runs.filter(r => r.mode === 'paper') },
compatibleDatasets () { return this.datasets.filter(d => d.pair === this.pair) },
latestSpread () { const values = [...this.series.spreadForward, ...this.series.spreadReverse].map(item => Number(item.value)).filter(Number.isFinite); return values.length ? `${Math.max(...values).toFixed(2)} bps` : '—' },
    coverage () { const start = moment(this.start); const end = moment(this.end); const hours = Math.max(1, end.diff(start, 'hours')); const dataset = this.compatibleDatasets.find(d => moment(d.start_at).isSameOrBefore(start) && moment(d.end_at).isSameOrAfter(end)); if (dataset) return { complete: true, description: `${dataset.start_at} → ${dataset.end_at}`, segments: Array(hours).fill(true) }; const nearest = this.compatibleDatasets[0]; const segments = Array.from({ length: Math.min(hours, 168) }, (_, index) => Boolean(nearest && moment(start).add(index, 'hours').isBetween(moment(nearest.start_at), moment(nearest.end_at), undefined, '[)'))); return { complete: false, description: this.$t('arbitrage.datasetGapDescription'), segments } },
    runColumns () { return [{ title: this.$t('arbitrage.mode'), dataIndex: 'mode' }, { title: this.$t('arbitrage.status'), dataIndex: 'status', scopedSlots: { customRender: 'status' } }, { title: this.$t('arbitrage.created'), dataIndex: 'created_at' }, { title: this.$t('arbitrage.details'), scopedSlots: { customRender: 'actions' } }] },
cycleColumns () { return [{ title: '#', dataIndex: 'seq' }, { title: this.$t('arbitrage.state'), dataIndex: 'body.state', scopedSlots: { customRender: 'state' } }, { title: this.$t('arbitrage.netCashFlow'), dataIndex: 'body.netCashFlow' }, { title: this.$t('arbitrage.exposure'), dataIndex: 'body.exposure' }] },
datasetColumns () { return [{ title: this.$t('arbitrage.dataset'), dataIndex: 'id' }, { title: this.$t('arbitrage.pair'), dataIndex: 'pair' }, { title: this.$t('arbitrage.coverage'), customRender: (_, row) => `${row.start_at} → ${row.end_at}` }] }
  },
  async created () { this.tickClock(); this.clockTimer = setInterval(this.tickClock, 1000); await this.refresh(); this.timer = setInterval(() => this.refresh(false), 5000) },
beforeDestroy () { clearInterval(this.timer); clearInterval(this.clockTimer); clearTimeout(this.uploadTimer) },
  methods: {
    tickClock () { this.nowLabel = moment.utc().format('YYYY-MM-DD HH:mm:ss') },
pretty (value) { return JSON.stringify(value, null, 2) },
feeRateLabel (venue) { const account = this.feeRates[venue]; const config = this.config && this.config.venues && this.config.venues[venue]; const maker = Number(account && account.makerFeeBps); const taker = Number(account && account.takerFeeBps); const fallback = Number(config && config.takerFeeBps); if (Number.isFinite(maker) && Number.isFinite(taker)) return `M ${maker.toFixed(2)} / T ${taker.toFixed(2)} bps`; return Number.isFinite(fallback) ? `T ${fallback.toFixed(2)} bps` : '—' },
active (value) { return ['queued', 'running', 'stopping'].includes(value) },
status (value) { const key = `arbitrage.status.${value}`; return this.$te(key) ? this.$t(key) : value },
statusColor (value) { return value === 'succeeded' ? 'green' : value === 'failed' || value === 'interrupted' ? 'red' : 'blue' },
    async request (path, method, data, key) { const result = await api(path, method, data, key); if (result.code !== 1) throw new Error(result.data?.reason || this.$t(result.msg)); return result.data },
showError (err) { this.error = err.response?.data?.data?.reason || err.message || this.$t('arbitrage.error') },
setPair () { this.config = JSON.parse(JSON.stringify(this.templates.find(t => t.pair === this.pair))); if (this.credentials.length) this.refreshFeeRates(false, true) },
    onRangeChange (dates) { if (!dates || dates.length !== 2) return; this.start = dates[0].toISOString(); this.end = dates[1].toISOString(); this.selectedPreset = null },
setPreset (hours) { const end = moment.utc().subtract(2, 'days').startOf('day'); this.rangeValue = [end.clone().subtract(hours, 'hours'), end]; this.start = this.rangeValue[0].toISOString(); this.end = end.toISOString(); this.selectedPreset = hours },
    async refresh (show = true) { if (this.loading) return; this.loading = true; try { if (!this.config) { const t = await this.request('/templates'); this.templates = t.items || []; this.pairs = this.templates.map(item => item.pair).filter(Boolean); if (!this.pairs.includes(this.pair)) this.pair = this.pairs[0] || 'BTC/USDT'; this.setPair() }; const [d, r, credentials] = await Promise.all([this.request('/datasets'), this.request('/runs'), listExchangeCredentials()]); this.datasets = d.items; this.runs = r.items; this.credentials = credentials && credentials.data ? credentials.data.items || [] : []; if (this.selectedCredentialIds.BINANCE == null && this.binanceCredentials.length) this.$set(this.selectedCredentialIds, 'BINANCE', this.binanceCredentials[0].id); if (this.selectedCredentialIds.OKX == null && this.okxCredentials.length) this.$set(this.selectedCredentialIds, 'OKX', this.okxCredentials[0].id); await this.refreshFeeRates(false); if (!this.selected && this.runs.length) this.selected = this.runs[0]; if (this.job && this.active(this.job.status)) this.job = await this.request(`/jobs/${this.job.job_id}`); if (this.selected) { this.selected = await this.request(`/runs/${this.selected.id}`); await this.loadSeries(this.selected.id) }; this.buildMetrics() } catch (err) { if (show) this.showError(err) } finally { this.loading = false } },
    async refreshFeeRates (showError = true, force = false) { if (this.feeLoading || (!force && Date.now() - this.feeRateFetchedAt < 60000)) return; this.feeLoading = true; try { const result = await getArbitrageFeeRates({ pair: this.pair, binanceCredentialId: this.selectedCredentialIds.BINANCE, okxCredentialId: this.selectedCredentialIds.OKX }); this.feeRates = result && result.data ? result.data.venues || {} : {}; this.feeRateFetchedAt = Date.now(); Object.keys(this.feeRates).forEach(venue => { const rate = this.feeRates[venue]; const value = Number(rate && rate.takerFeeBps); if (rate && rate.available && Number.isFinite(value) && this.config && this.config.venues && this.config.venues[venue]) this.$set(this.config.venues[venue], 'takerFeeBps', String(value)) }) } catch (err) { this.feeRateFetchedAt = Date.now(); if (showError) this.showError(err) } finally { this.feeLoading = false } },
    async submit (path, data) { if (this.submitting) return; this.submitting = true; try { const result = await this.request(path, 'post', data, crypto.randomUUID()); this.job = await this.request(`/jobs/${result.jobId}`); await this.refresh() } catch (err) { this.showError(err) } finally { this.submitting = false } },
submitImport () { return this.submit('/datasets/import', { pair: this.pair, start: this.start, end: this.end }) },
uploadFiles ({ file, onSuccess, onError }) { this.uploadQueue.push({ file, onSuccess, onError }); clearTimeout(this.uploadTimer); this.uploadTimer = setTimeout(() => this.flushUploads(), 120) },
async flushUploads () { const queue = this.uploadQueue.splice(0); if (!queue.length) return; const form = new FormData(); form.append('pair', this.pair); form.append('start', this.start); form.append('end', this.end); queue.forEach(item => form.append('files', item.file)); try { const result = await arbitrageUpload('/datasets/upload', form, crypto.randomUUID()); if (result.code !== 1) throw new Error(result.data?.reason || this.$t(result.msg)); this.job = await this.request(`/jobs/${result.data.jobId}`); this.$message.success(this.$t('arbitrage.uploadQueued')); queue.forEach(item => item.onSuccess(result.data)) } catch (err) { this.showError(err); queue.forEach(item => item.onError(err)) } },
    submitRun (mode) { const payload = { ...this.config, mode }; if (mode === 'backtest') Object.assign(payload, { start: this.start, end: this.end, datasetId: this.compatibleDatasets.find(d => moment(d.start_at).isSameOrBefore(moment(this.start)) && moment(d.end_at).isSameOrAfter(moment(this.end)))?.id }); if (mode === 'backtest' && !payload.datasetId) return; return this.submit(mode === 'paper' ? '/paper-sessions' : '/backtests', payload) },
cancel (id) { return this.request(`/jobs/${id}/cancel`, 'post', {}).then(() => this.refresh()).catch(this.showError) },
    async selectRun (id) { try { this.selected = await this.request(`/runs/${id}`); this.tab = 'reports'; await Promise.all([this.loadRecords('cycles'), this.loadSeries(id)]) } catch (err) { this.showError(err) } },
async loadRecords (kind) { const data = await this.request(`/runs/${this.selected.id}/${kind}`, 'get', { cursor: 0 }); this[kind] = data.items },
async loadSeries (runId) { const metrics = [['equity', 'equity'], ['drawdown', 'drawdown'], ['exposure', 'exposure'], ['fees', 'fees'], ['spread', 'spreadForward', 'buy_binance_sell_okx'], ['spread', 'spreadReverse', 'buy_okx_sell_binance']]; await Promise.all(metrics.map(async ([metric, key, direction = '']) => { const result = await this.request(`/runs/${runId}/series`, 'get', { metric, direction, resolution: 600 }); this.$set(this.series, key, result.items || []) })) },
buildMetrics () { this.monitorMetrics = [{ key: 'spreadBest', value: this.latestSpread, note: 'Binance ↔ OKX · bps', tone: 'positive' }, { key: 'realizedProfit', value: this.summary.realizedProfit || '0', note: 'USDT', tone: 'positive' }, { key: 'equity', value: this.summary.equity || '—', note: 'USDT', tone: '' }, { key: 'exposureBase', value: this.summary.exposureBase || '0', note: 'BTC / ETH', tone: 'warning' }] },
selectCycle (row) { this.selectedCycle = row },
rerun () { this.tab = 'configure' },
exportReport () { window.print() }
  }
}
</script>

<style scoped>
.arbitrage-workspace { min-height: 100%; padding: 20px 24px 32px; background: #f7f8f6; color: #253247; }.workspace-heading, .report-heading, .toolbar-row, .config-actions { display: flex; align-items: center; gap: 12px; }.workspace-heading, .report-heading { justify-content: space-between; margin-bottom: 16px; }h1, h2 { margin: 4px 0 0; color: #253247; }.eyebrow, .metric-label { color: #7a8494; font-size: 12px; }.toolbar-row { background: #fff; border: 1px solid #e6eaf0; padding: 10px 12px; border-radius: 6px; flex-wrap: wrap; }.pair-select { width: 160px; }.credential-select { width: 180px; }.toolbar-spacer { flex: 1; }.utc-label { color: #7a8494; font-size: 12px; }.metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 14px 0; }.report-metrics { grid-template-columns: repeat(4, 1fr); }.metric-card { border-color: #e6eaf0; }.metric-value { font-size: 22px; font-weight: 600; margin-top: 6px; }.metric-value.positive { color: #52c41a; }.metric-value.warning { color: #f5a623; }.metric-note { color: #98a2b3; font-size: 12px; margin-top: 4px; }.content-grid, .report-chart-grid, .report-detail-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 14px; margin-top: 14px; }.report-detail-grid { grid-template-columns: 2fr 1fr; }.venue-stack { display: grid; gap: 14px; }.chart-card, .config-card, .dataset-side-card { border-color: #e6eaf0; }.config-layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 16px; }.preset-row { display: flex; gap: 8px; margin: -4px 0 16px; }.coverage-strip { display: flex; gap: 2px; margin: 14px 0; }.coverage-segment { flex: 1; height: 14px; border-radius: 2px; }.coverage-segment.available { background: #52c41a; }.coverage-segment.missing { background: #f5a623; }.config-actions { justify-content: flex-end; flex-wrap: wrap; }.assumption-list { padding-left: 18px; color: #7a8494; font-size: 12px; line-height: 1.8; }.task-card { margin-top: 16px; }.task-card pre { max-height: 160px; overflow: auto; }.report-shell { margin-top: 20px; }@media (max-width: 1100px) { .metric-grid, .report-metrics { grid-template-columns: repeat(2, 1fr); }.content-grid, .report-chart-grid, .report-detail-grid, .config-layout { grid-template-columns: 1fr; } }
</style>
