<template>
  <div>
    <nav class="nav">
      <NuxtLink to="/apps">应用市场</NuxtLink>
      <NuxtLink to="/environments">用户环境</NuxtLink>
      <NuxtLink to="/resources">资源监控</NuxtLink>
      <NuxtLink to="/security">安全监控</NuxtLink>
    </nav>
    <NuxtPage />
  </div>
</template>

<style>
.nav {
  display: flex;
  gap: 1rem;
  max-width: 920px;
  margin: 1.25rem auto 0;
  padding: 0 1rem;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.nav a {
  color: #0b57d0;
  text-decoration: none;
}
.nav a.router-link-active {
  font-weight: 600;
  text-decoration: underline;
}
</style>
