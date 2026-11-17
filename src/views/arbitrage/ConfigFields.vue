<template>
  <div>
    <a-divider>{{ $t('arbitrage.balances') }}</a-divider>
    <div class="venue-grid">
      <a-card v-for="(params, venue) in config.venues" :key="venue" :title="venue" size="small">
        <a-form-item v-for="(_, key) in params" :key="key" :label="$t('arbitrage.' + key)">
          <a-input-number v-if="key === 'latencyMs'" :value="params[key]" @input="update(['venues', venue, key], $event)" :min="0" :max="60000" />
          <a-input v-else :value="params[key]" @input="update(['venues', venue, key], $event)" />
        </a-form-item>
      </a-card>
    </div>
    <div class="parameters">
      <a-form-item v-for="(_, key) in config.strategy" :key="key" :label="$t('arbitrage.' + key)">
        <a-input-number v-if="key.endsWith('Ms')" :value="config.strategy[key]" @input="update(['strategy', key], $event)" :min="1" :max="60000" />
        <a-input v-else :value="config.strategy[key]" @input="update(['strategy', key], $event)" />
      </a-form-item>
      <a-form-item :label="$t('arbitrage.maxExposureQuote')"><a-input :value="config.risk.maxExposureQuote" @input="update(['risk', 'maxExposureQuote'], $event)" /></a-form-item>
      <a-form-item :label="$t('arbitrage.maxCycles')"><a-input-number :value="config.risk.maxCycles" @input="update(['risk', 'maxCycles'], $event)" :min="1" :max="1000000" /></a-form-item>
      <a-form-item :label="$t('arbitrage.seed')"><a-input-number :value="config.seed" @input="update(['seed'], $event)" :min="0" :max="2147483647" /></a-form-item>
    </div>
  </div>
</template>
<script>
export default {
  props: { config: { type: Object, required: true } },
  methods: {
    update (path, value) {
      const next = JSON.parse(JSON.stringify(this.config))
      const parent = path.slice(0, -1).reduce((obj, key) => obj[key], next)
      parent[path[path.length - 1]] = value?.target ? value.target.value : value
      this.$emit('update:config', next)
    }
  }
}
</script>
<style scoped>
.venue-grid, .parameters { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; margin: 16px 0; }
.ant-input-number { width: 100%; }
</style>
