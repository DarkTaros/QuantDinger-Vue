<template>
  <div class="series-chart" :class="{ 'series-chart--empty': !hasData }">
    <div v-if="!hasData" class="series-chart__empty">{{ emptyText }}</div>
    <div v-else ref="chart" class="series-chart__canvas" />
  </div>
</template>

<script>
import * as echarts from 'echarts'

export default {
  props: {
    series: { type: Array, default: () => [] },
    type: { type: String, default: 'line' },
    color: { type: String, default: '#52c41a' },
    secondSeries: { type: Array, default: () => [] },
    secondColor: { type: String, default: '#f5a623' },
    unit: { type: String, default: '' },
    emptyText: { type: String, default: '暂无图表数据' },
    height: { type: Number, default: 250 }
  },
  data () { return { chart: null, observer: null } },
  computed: {
    hasData () { return this.series.length > 0 || this.secondSeries.length > 0 }
  },
  watch: { series: 'render', secondSeries: 'render' },
  mounted () {
    this.render()
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.chart && this.chart.resize())
      this.observer.observe(this.$el)
    } else {
      window.addEventListener('resize', this.resize)
    }
  },
  beforeDestroy () {
    if (this.observer) this.observer.disconnect()
    window.removeEventListener('resize', this.resize)
    if (this.chart) this.chart.dispose()
  },
  methods: {
    resize () { if (this.chart) this.chart.resize() },
    render () {
      this.$nextTick(() => {
        if (!this.hasData || !this.$refs.chart) return
        if (!this.chart) this.chart = echarts.init(this.$refs.chart)
        const make = (items) => items.map(item => [item.ts, Number(item.value)])
        const option = {
          animation: false,
          grid: { left: 48, right: 18, top: 18, bottom: 30 },
          tooltip: { trigger: 'axis', valueFormatter: value => `${value} ${this.unit}` },
          xAxis: { type: 'time', axisLabel: { color: '#7a8494' }, axisLine: { lineStyle: { color: '#e6eaf0' } } },
          yAxis: { type: 'value', scale: true, axisLabel: { color: '#7a8494' }, splitLine: { lineStyle: { color: '#f0f2f5' } } },
          series: [
            { type: this.type, data: make(this.series), smooth: true, showSymbol: false, lineStyle: { color: this.color, width: 2 }, itemStyle: { color: this.color }, areaStyle: this.type === 'line' ? { color: `${this.color}20` } : undefined },
            ...(this.secondSeries.length ? [{ type: this.type, data: make(this.secondSeries), smooth: true, showSymbol: false, lineStyle: { color: this.secondColor, width: 2 }, itemStyle: { color: this.secondColor }, areaStyle: this.type === 'line' ? { color: `${this.secondColor}20` } : undefined }] : [])
          ]
        }
        this.chart.setOption(option, true)
      })
    }
  }
}
</script>

<style scoped>
.series-chart { min-height: 180px; position: relative; }
.series-chart__canvas { width: 100%; height: 250px; }
.series-chart__empty { color: #98a2b3; display: flex; align-items: center; justify-content: center; height: 180px; background: #fafbfc; border: 1px dashed #dfe4ea; }
</style>
