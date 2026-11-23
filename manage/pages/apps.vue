<script setup lang="ts">
type AppRow = {
  id: string
  name: string
  kind: string
  description: string
}

const rows = ref<AppRow[]>([])
const error = ref('')

async function refresh() {
  error.value = ''
  const res = await fetch('/manage/api/apps')
  const text = await res.text()
  let data: unknown = text
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    throw new Error(typeof data === 'string' ? data : text || `HTTP ${res.status}`)
  }
  rows.value = data as AppRow[]
}

onMounted(() => {
  void refresh().catch((e) => {
    error.value = e instanceof Error ? e.message : String(e)
  })
})
</script>

<template>
  <main class="page">
    <h1>应用市场</h1>
    <p class="hint">只读。列出当前镜像内的应用，不能安装或修改。</p>

    <p v-if="error" class="err">{{ error }}</p>

    <table>
      <thead>
        <tr>
          <th>id</th>
          <th>名称</th>
          <th>类型</th>
          <th>说明</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <td>{{ row.id }}</td>
          <td>{{ row.name }}</td>
          <td>{{ row.kind }}</td>
          <td>{{ row.description }}</td>
        </tr>
        <tr v-if="!rows.length && !error">
          <td colspan="4">暂无应用</td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<style scoped>
.page {
  max-width: 920px;
  margin: 2rem auto;
  padding: 0 1rem;
  font-family: ui-sans-serif, system-ui, sans-serif;
  color: #1a1a1a;
}
.hint {
  color: #666;
  margin-top: 0.25rem;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1.25rem;
}
th, td {
  border-bottom: 1px solid #e5e5e5;
  text-align: left;
  padding: 0.55rem 0.4rem;
  font-size: 0.95rem;
}
.err { color: #b00020; }
</style>
