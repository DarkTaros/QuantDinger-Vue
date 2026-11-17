<template>
  <a-card size="small" class="venue-card">
    <div class="venue-title"><span class="status-dot" /> {{ venue }} Spot <a-tag color="green">{{ $t('arbitrage.healthy') }}</a-tag></div>
    <a-descriptions :column="1" size="small"><a-descriptions-item :label="$t('arbitrage.latencyMs')">{{ latency }} ms</a-descriptions-item><a-descriptions-item :label="$t('arbitrage.sequenceStatus')">{{ $t('arbitrage.connected') }}</a-descriptions-item><a-descriptions-item :label="$t('arbitrage.quoteBalance')">{{ balance }}</a-descriptions-item></a-descriptions>
  </a-card>
</template>
<script>
export default {
  props: { venue: { type: String, required: true }, summary: { type: Object, default: () => ({}) } },
  computed: {
    latency () { return this.summary.feedHealth?.[this.venue]?.latencyMs || '—' },
    balance () { return this.summary.balances?.[this.venue]?.USDT || '—' }
  }
}
</script>
<style scoped>
.venue-title { font-weight: 600; display: flex; align-items: center; gap: 6px; }.venue-title .ant-tag { margin-left: auto; }.status-dot { width: 8px; height: 8px; background: #52c41a; border-radius: 50%; display: inline-block; }
</style>
