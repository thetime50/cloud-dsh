<script setup lang="ts">
type InstanceRow = {
  id: string
  status: string
  port: number | null
  pid: number | null
}

const rows = ref<InstanceRow[]>([])
const newId = ref('')
const busy = ref(false)
const message = ref('')
const error = ref('')

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`/manage/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
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
  return data
}

async function refresh() {
  error.value = ''
  rows.value = await api('GET', '/instances') as InstanceRow[]
}

async function run(label: string, fn: () => Promise<unknown>) {
  if (busy.value) return
  busy.value = true
  message.value = ''
  error.value = ''
  try {
    await fn()
    message.value = label
    await refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

function create() {
  const id = newId.value.trim()
  return run('已新增', () => api('POST', '/instances', id ? { id } : {}))
}

function start(id: string) {
  return run(`已启动 ${id}`, () => api('POST', `/instances/${encodeURIComponent(id)}/start`))
}

function stop(id: string) {
  return run(`已停止 ${id}`, () => api('POST', `/instances/${encodeURIComponent(id)}/stop`))
}

function remove(id: string) {
  if (!confirm(`删除环境 ${id}？`)) return
  return run(`已删除 ${id}`, () => api('DELETE', `/instances/${encodeURIComponent(id)}`))
}

onMounted(() => {
  void refresh().catch((e) => {
    error.value = e instanceof Error ? e.message : String(e)
  })
})
</script>

<template>
  <main class="page">
    <h1>用户环境</h1>
    <p class="hint">无鉴权，直接调用 /manage/api。仅用于本地联调。</p>

    <section class="create">
      <input v-model="newId" placeholder="可选实例 id" :disabled="busy" @keyup.enter="create">
      <button type="button" :disabled="busy" @click="create">新增</button>
      <button type="button" :disabled="busy" @click="refresh">刷新</button>
    </section>

    <p v-if="message" class="ok">{{ message }}</p>
    <p v-if="error" class="err">{{ error }}</p>

    <table>
      <thead>
        <tr>
          <th>id</th>
          <th>status</th>
          <th>port</th>
          <th>pid</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <td>
            <a :href="`/i/${row.id}/`" target="_blank" rel="noopener">{{ row.id }}</a>
          </td>
          <td>{{ row.status }}</td>
          <td>{{ row.port ?? '-' }}</td>
          <td>{{ row.pid ?? '-' }}</td>
          <td class="actions">
            <button type="button" :disabled="busy" @click="start(row.id)">启动</button>
            <button type="button" :disabled="busy" @click="stop(row.id)">停止</button>
            <button type="button" :disabled="busy" @click="remove(row.id)">删除</button>
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td colspan="5">暂无环境</td>
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
.create {
  display: flex;
  gap: 0.5rem;
  margin: 1.25rem 0;
}
input {
  flex: 1;
  padding: 0.45rem 0.6rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
button {
  padding: 0.4rem 0.75rem;
  border: 1px solid #bbb;
  border-radius: 4px;
  background: #f5f5f5;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  border-bottom: 1px solid #e5e5e5;
  text-align: left;
  padding: 0.55rem 0.4rem;
  font-size: 0.95rem;
}
.actions {
  display: flex;
  gap: 0.35rem;
}
.ok { color: #0a7a32; }
.err { color: #b00020; }
a { color: #0b57d0; }
</style>
