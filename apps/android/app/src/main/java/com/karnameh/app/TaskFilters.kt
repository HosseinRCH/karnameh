package com.karnameh.app

import org.json.JSONObject

data class TaskFilters(
    val statusId: String? = null,
    val priority: String? = null,
    val assigneeId: String? = null,
    val tagId: String? = null,
    val sortBy: String = "position",
    val groupBy: String = "none",
) {
    fun toJson(): String = JSONObject()
        .put("statusId", statusId ?: "")
        .put("priority", priority ?: "")
        .put("assigneeId", assigneeId ?: "")
        .put("tagId", tagId ?: "")
        .put("sortBy", sortBy)
        .put("groupBy", groupBy)
        .toString()

    companion object {
        fun fromJson(text: String): TaskFilters = runCatching {
            val json = JSONObject(text)
            TaskFilters(
                statusId = json.optString("statusId").takeIf { it.isNotBlank() },
                priority = json.optString("priority").takeIf { it.isNotBlank() },
                assigneeId = json.optString("assigneeId").takeIf { it.isNotBlank() },
                tagId = json.optString("tagId").takeIf { it.isNotBlank() },
                sortBy = json.optString("sortBy", "position"),
                groupBy = json.optString("groupBy", "none"),
            )
        }.getOrDefault(TaskFilters())
    }
}

fun applyTaskFilters(tasks: List<TaskRowDto>, filters: TaskFilters): List<TaskRowDto> {
    var result = tasks
    filters.statusId?.let { statusId ->
        result = result.filter { it.statusId == statusId }
    }
    filters.priority?.let { priority ->
        result = result.filter { it.priority == priority }
    }
    filters.assigneeId?.let { assigneeId ->
        result = result.filter { task -> task.assignees.any { it.id == assigneeId } }
    }
    filters.tagId?.let { tagId ->
        result = result.filter { task -> task.tags.any { it.id == tagId } }
    }
    return when (filters.sortBy) {
        "priority" -> result.sortedBy { priorityOrder(it.priority) }
        "title" -> result.sortedBy { it.title }
        "dueDate" -> result.sortedBy { it.dueDate ?: "9999-12-31" }
        else -> result
    }
}

private fun priorityOrder(priority: String): Int = when (priority) {
    "urgent" -> 0
    "high" -> 1
    "normal" -> 2
    "low" -> 3
    else -> 4
}
