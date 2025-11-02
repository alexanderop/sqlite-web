<script setup lang="ts">
import { ref } from "vue";
import { useSQLiteQuery, useSQLiteClientAsync } from "@alexop/sqlite-vue";

const { rows: todos, loading, error, refresh } = useSQLiteQuery(
  "SELECT * FROM todos ORDER BY rowid DESC",
  [],
  ["todos"]
);

const newTitle = ref("");

async function addTodo() {
  const db = await useSQLiteClientAsync();
  await db.exec(
    "INSERT INTO todos (id, title) VALUES (?, ?)",
    [crypto.randomUUID(), newTitle.value || "Untitled"]
  );
  db.notifyTable("todos");
  newTitle.value = "";
  await refresh();
}
</script>

<template>
  <main class="p-6">
    <h1 class="text-2xl font-bold mb-4">SQLite Vue test</h1>

    <form class="flex gap-2 mb-4" @submit.prevent="addTodo">
      <input
        v-model="newTitle"
        class="border px-2 py-1 rounded flex-1"
        placeholder="Todo title"
      />
      <button
        type="submit"
        class="bg-blue-600 text-white px-4 py-1 rounded"
      >
        Add
      </button>
    </form>

    <p v-if="loading">Loading...</p>
    <p v-if="error">{{ error.message }}</p>

    <ul v-if="todos.length">
      <li v-for="t in todos" :key="t.id">
        {{ t.title }}
      </li>
    </ul>
    <p v-else>No todos yet.</p>
  </main>
</template>
