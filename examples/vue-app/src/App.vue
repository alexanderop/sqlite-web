<script setup lang="ts">
import { ref } from "vue";
import { useSQLiteClientAsync, useSQLiteQuery } from "./composables/db";

const { rows: todos, loading, error } = useSQLiteQuery(
  (db) => db.query("todos").orderBy("createdAt", "DESC").all(),
  { tables: ["todos"] }
);

const newTitle = ref("");
const editingId = ref<string | null>(null);
const editingTitle = ref("");

// Get the client promise during setup
const dbPromise = useSQLiteClientAsync();

async function addTodo() {
  if (!newTitle.value.trim()) return;

  const db = await dbPromise;

  // Use insert builder with validation
  await db.insert("todos").values({
    completed: false, createdAt: new Date().toISOString(), id: crypto.randomUUID(), title: newTitle.value,
  });

  db.notifyTable("todos");
  newTitle.value = "";
}

async function deleteTodo(id: string) {
  const db = await dbPromise;

  // Use delete builder
  await db.delete("todos").where("id", "=", id).execute();

  db.notifyTable("todos");
}

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

function startEdit(todo: Todo) {
  editingId.value = todo.id;
  editingTitle.value = todo.title;
}

function cancelEdit() {
  editingId.value = null;
  editingTitle.value = "";
}

async function updateTodo(id: string) {
  if (!editingTitle.value.trim()) return;

  const db = await dbPromise;

  // Use update builder
  await db.update("todos")
    .where("id", "=", id)
    .set({ title: editingTitle.value })
    .execute();

  db.notifyTable("todos");
  editingId.value = null;
  editingTitle.value = "";
}

async function toggleComplete(id: string, completed: boolean) {
  const db = await dbPromise;

  await db.update("todos")
    .where("id", "=", id)
    .set({ completed: !completed })
    .execute();

  db.notifyTable("todos");
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

    <ul v-if="todos && todos.length" class="space-y-2">
      <li
        v-for="t in todos"
        :key="t.id"
        class="flex items-center gap-2 p-3 border rounded bg-white"
      >
        <!-- Edit mode -->
        <template v-if="editingId === t.id">
          <input
            v-model="editingTitle"
            class="border px-2 py-1 rounded flex-1"
            @keyup.enter="updateTodo(t.id)"
            @keyup.esc="cancelEdit"
            autofocus
          />
          <button
            @click="updateTodo(t.id)"
            class="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
          >
            Save
          </button>
          <button
            @click="cancelEdit"
            class="bg-gray-400 text-white px-3 py-1 rounded hover:bg-gray-500"
          >
            Cancel
          </button>
        </template>

        <!-- View mode -->
        <template v-else>
          <input
            type="checkbox"
            :checked="t.completed"
            @change="toggleComplete(t.id, t.completed)"
            class="w-5 h-5"
          />
          <span class="flex-1" :class="{ 'line-through text-gray-400': t.completed }">
            {{ t.title }}
          </span>
          <button
            @click="startEdit(t)"
            class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            Edit
          </button>
          <button
            @click="deleteTodo(t.id)"
            class="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
          >
            Delete
          </button>
        </template>
      </li>
    </ul>
    <p v-else-if="!loading" class="text-gray-500">No todos yet.</p>
  </main>
</template>
