package com.karnameh.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID

data class WorkspaceDto(val id: String, val name: String)

data class SpaceDto(val id: String, val name: String)

data class TaskListDto(val id: String, val name: String)

data class StatusDto(
    val id: String,
    val name: String,
    val type: String,
    val color: String,
)

data class TaskRowDto(
    val id: String,
    val title: String,
    val statusId: String,
    val priority: String,
    val dueDate: String?,
    val completedAt: String?,
    val listId: String = "",
    val startDate: String? = null,
    val startTime: String? = null,
    val dueTime: String? = null,
    val estimateMs: Long? = null,
    val workedMinutes: Int = 0,
    val done: Boolean = false,
    val tags: List<TagDto> = emptyList(),
    val assignees: List<MemberDto> = emptyList(),
)

data class TagDto(val id: String, val name: String, val color: String)

data class MemberDto(val id: String, val name: String, val email: String, val role: String)

data class FieldDto(val id: String, val listId: String, val name: String, val type: String)

data class SavedViewDto(
    val id: String,
    val listId: String,
    val name: String,
    val configJson: String,
    val isDefault: Boolean,
)

data class FocusSessionDto(
    val id: String,
    val mode: String,
    val seconds: Int,
    val completed: Boolean,
    val startedAt: String,
    val taskTitle: String?,
)

data class AutomationDto(
    val id: String,
    val name: String,
    val enabled: Boolean,
    val triggerType: String,
    val triggerTo: String,
    val conditionPriority: String,
    val actionType: String,
    val actionValue: String,
)

data class NamedCount(val id: String, val label: String, val color: String, val count: Int)

data class DayMinutes(val date: String, val minutes: Int)

data class WorkloadRow(
    val memberId: String,
    val name: String,
    val openTasks: Int,
    val estimateMinutes: Long,
)

data class AttachmentDto(
    val id: String,
    val taskId: String,
    val name: String,
    val fileName: String,
    val mimeType: String,
    val size: Long,
)

data class TaskFullDto(
    val id: String,
    val listId: String,
    val title: String,
    val description: String?,
    val statusId: String,
    val priority: String,
    val startDate: String?,
    val startTime: String?,
    val dueDate: String?,
    val dueTime: String?,
    val estimateMs: Long?,
    val workedMinutes: Int,
    val done: Boolean,
    val parentTaskId: String?,
    val completedAt: String?,
)

data class TimeEntryDto(
    val id: String,
    val taskId: String?,
    val taskTitle: String?,
    val description: String?,
    val minutes: Int,
    val spentOn: String,
)

data class GoalDto(
    val id: String,
    val name: String,
    val currentValue: Double,
    val targetValue: Double,
    val progress: Int,
)

data class ActivityDto(
    val id: String,
    val title: String,
    val action: String,
    val entityType: String,
    val entityId: String?,
    val createdAt: String,
)

data class StatsDto(
    val totalTasks: Int,
    val openTasks: Int,
    val doneToday: Int,
    val dueToday: Int,
    val overdue: Int,
    val todayMinutes: Int,
    val spaces: Int,
    val lists: Int,
    val goals: Int,
)

/**
 * Fully offline store. The single source of truth is a JSON document in the app's
 * private storage that uses the same `karnameh-export` bundle format as the server,
 * so files can be moved between the Android and Windows apps.
 */
class OfflineStore(private val context: Context) {
    private val file = File(context.filesDir, "karnameh.json")
    private var bundle: JSONObject = readOrCreate()

    fun workspace(): WorkspaceDto? = bundle.optJSONObject("workspace")?.let {
        WorkspaceDto(
            id = it.optString("id"),
            name = it.optString("name").ifBlank { "میزکار من" },
        )
    }

    // ---- Hierarchy -------------------------------------------------------

    fun spaces(): List<SpaceDto> = objects("spaces")
        .sortedBy { it.optInt("position", 0) }
        .map { SpaceDto(it.optString("id"), it.optString("name")) }

    fun lists(spaceId: String): List<TaskListDto> = objects("lists")
        .filter { it.optString("spaceId") == spaceId }
        .sortedBy { it.optInt("position", 0) }
        .map { TaskListDto(it.optString("id"), it.optString("name")) }

    fun allLists(): List<TaskListDto> = objects("lists")
        .sortedBy { it.optInt("position", 0) }
        .map { TaskListDto(it.optString("id"), it.optString("name")) }

    fun listName(listId: String): String =
        objects("lists").firstOrNull { it.optString("id") == listId }
            ?.optString("name") ?: "لیست"

    fun statuses(listId: String): List<StatusDto> = objects("statuses")
        .filter { it.optString("listId") == listId }
        .sortedBy { it.optInt("position", 0) }
        .map {
            StatusDto(
                id = it.optString("id"),
                name = it.optString("name"),
                type = it.optString("type"),
                color = it.optString("color", "#94a3b8"),
            )
        }

    fun status(statusId: String): StatusDto? =
        objects("statuses").firstOrNull { it.optString("id") == statusId }?.let {
            StatusDto(
                id = it.optString("id"),
                name = it.optString("name"),
                type = it.optString("type"),
                color = it.optString("color", "#94a3b8"),
            )
        }

    fun createSpace(name: String): SpaceDto {
        val spaces = bundle.optJSONArray("spaces") ?: JSONArray().also { bundle.put("spaces", it) }
        val stamp = now()
        val item = JSONObject()
            .put("id", UUID.randomUUID().toString())
            .put("workspaceId", workspace()?.id ?: "")
            .put("name", name)
            .put("color", "#0f766e")
            .put("position", spaces.length())
            .put("createdAt", stamp)
            .put("updatedAt", stamp)
        spaces.put(item)
        log("فضای «$name» ساخته شد", "created", "space", item.optString("id"))
        write()
        return SpaceDto(item.optString("id"), name)
    }

    fun createList(spaceId: String, name: String): TaskListDto {
        val lists = bundle.optJSONArray("lists") ?: JSONArray().also { bundle.put("lists", it) }
        val stamp = now()
        val listId = UUID.randomUUID().toString()
        val item = JSONObject()
            .put("id", listId)
            .put("spaceId", spaceId)
            .put("folderId", JSONObject.NULL)
            .put("name", name)
            .put("position", lists.length())
            .put("createdAt", stamp)
            .put("updatedAt", stamp)
        lists.put(item)

        val statuses = bundle.optJSONArray("statuses") ?: JSONArray().also { bundle.put("statuses", it) }
        statuses.put(status(listId, "برای انجام", "open", "#94a3b8", 0))
        statuses.put(status(listId, "در حال انجام", "custom", "#3b82f6", 1))
        statuses.put(status(listId, "انجام شد", "done", "#22c55e", 2))

        log("لیست «$name» ساخته شد", "created", "list", listId)
        write()
        return TaskListDto(listId, name)
    }

    fun createStatus(listId: String, name: String): StatusDto {
        val statuses = bundle.optJSONArray("statuses") ?: JSONArray().also { bundle.put("statuses", it) }
        val position = objects("statuses").count { it.optString("listId") == listId }
        val item = status(listId, name, "custom", "#8b5cf6", position)
        statuses.put(item)
        log("وضعیت «$name» ساخته شد", "created", "status", item.optString("id"))
        write()
        return StatusDto(item.optString("id"), name, "custom", "#8b5cf6")
    }

    // ---- Tasks -----------------------------------------------------------

    fun tasks(listId: String, query: String? = null): List<TaskRowDto> {
        val worked = workedMinutesByTask()
        return objects("tasks")
            .filter { it.optString("listId") == listId }
            .filter { matchesQuery(it, query) }
            .sortedBy { it.optInt("position", 0) }
            .map { toRow(it, worked) }
    }

    fun allTasks(query: String? = null): List<TaskRowDto> {
        val worked = workedMinutesByTask()
        return objects("tasks")
            .filter { matchesQuery(it, query) }
            .sortedBy { it.optInt("position", 0) }
            .map { toRow(it, worked) }
    }

    fun task(taskId: String): TaskFullDto? = findTask(taskId)?.let { toFull(it) }

    fun subtasks(parentTaskId: String): List<TaskRowDto> = objects("tasks")
        .filter { it.optString("parentTaskId") == parentTaskId }
        .sortedBy { it.optInt("position", 0) }
        .map { toRow(it) }

    fun createTask(listId: String, title: String, parentTaskId: String? = null): TaskRowDto {
        val tasks = bundle.optJSONArray("tasks") ?: JSONArray().also { bundle.put("tasks", it) }
        val firstStatus = statuses(listId).firstOrNull()
        val stamp = now()
        val task = JSONObject()
            .put("id", UUID.randomUUID().toString())
            .put("listId", listId)
            .put("parentTaskId", parentTaskId ?: JSONObject.NULL)
            .put("title", title)
            .put("description", JSONObject.NULL)
            .put("statusId", firstStatus?.id ?: "")
            .put("priority", "none")
            .put("position", tasks.length())
            .put("startDate", JSONObject.NULL)
            .put("startTime", JSONObject.NULL)
            .put("dueDate", JSONObject.NULL)
            .put("dueTime", JSONObject.NULL)
            .put("completedAt", JSONObject.NULL)
            .put("estimateMs", JSONObject.NULL)
            .put("createdAt", stamp)
            .put("updatedAt", stamp)
        tasks.put(task)
        runAutomations("task.created", task.optString("id"), null, 0)
        log("کار «$title» ساخته شد", "created", "task", task.optString("id"))
        write()
        return toRow(task)
    }

    fun updateTask(taskId: String, patch: Map<String, Any?>) {
        val task = findTask(taskId) ?: return
        for ((key, value) in patch) {
            task.put(key, value ?: JSONObject.NULL)
        }
        task.put("updatedAt", now())
        runAutomations("task.updated", taskId, null, 0)
        log("کار «${task.optString("title")}» ویرایش شد", "updated", "task", taskId)
        write()
    }

    fun setStatus(taskId: String, statusId: String): TaskRowDto? {
        val status = status(statusId)
        val task = findTask(taskId) ?: return null
        task.put("statusId", statusId)
        val isDone = status?.type == "done" || status?.type == "closed"
        task.put("completedAt", if (isDone) now() else JSONObject.NULL)
        task.put("updatedAt", now())
        runAutomations("task.status_changed", taskId, status?.name, 0)
        log(
            "وضعیت «${task.optString("title")}» به ${status?.name ?: "—"} تغییر کرد",
            "status_changed",
            "task",
            taskId,
        )
        write()
        return toRow(task)
    }

    fun deleteTask(taskId: String) {
        val tasks = bundle.optJSONArray("tasks") ?: return
        val title = findTask(taskId)?.optString("title") ?: "کار"
        val remaining = JSONArray()
        for (index in 0 until tasks.length()) {
            val item = tasks.optJSONObject(index) ?: continue
            val id = item.optString("id")
            if (id == taskId || item.optString("parentTaskId") == taskId) continue
            remaining.put(item)
        }
        bundle.put("tasks", remaining)
        removeWhere("timeEntries", "taskId", taskId)
        removeWhere("taskTags", "taskId", taskId)
        log("کار «$title» حذف شد", "deleted", "task", taskId)
        write()
    }

    // ---- Time tracking ---------------------------------------------------

    fun addTimeEntry(
        taskId: String?,
        minutes: Int,
        description: String?,
        spentOn: String = LocalDate.now().toString(),
    ): TimeEntryDto {
        val entries = bundle.optJSONArray("timeEntries") ?: JSONArray().also {
            bundle.put("timeEntries", it)
        }
        val entry = JSONObject()
            .put("id", UUID.randomUUID().toString())
            .put("taskId", taskId ?: JSONObject.NULL)
            .put("description", description ?: JSONObject.NULL)
            .put("durationMinutes", minutes.coerceAtLeast(1))
            .put("billable", false)
            .put("spentOn", spentOn)
            .put("createdAt", now())
        entries.put(entry)
        log("${minutes.coerceAtLeast(1)} دقیقه زمان ثبت شد", "time_logged", "time", entry.optString("id"))
        write()
        return toTimeEntry(entry)
    }

    fun timeEntries(): List<TimeEntryDto> = objects("timeEntries")
        .sortedWith(compareByDescending<JSONObject> { it.optString("spentOn") }
            .thenByDescending { it.optString("createdAt") })
        .map { toTimeEntry(it) }

    fun todayMinutes(): Int = objects("timeEntries")
        .filter { it.optString("spentOn") == LocalDate.now().toString() }
        .sumOf { it.optInt("durationMinutes", 0) }

    fun deleteTimeEntry(entryId: String) {
        removeWhere("timeEntries", "id", entryId)
        write()
    }

    // ---- Goals -----------------------------------------------------------

    fun goals(): List<GoalDto> = objects("goals").mapNotNull { goal ->
        val goalId = goal.optString("id")
        val target = objects("targets").firstOrNull { it.optString("goalId") == goalId }
        val targetValue = target?.optDouble("targetValue", 0.0) ?: 0.0
        val currentValue = target?.optDouble("currentValue", 0.0) ?: 0.0
        val progress = if (targetValue > 0) {
            ((currentValue / targetValue) * 100).toInt().coerceIn(0, 100)
        } else {
            goal.optInt("progress", 0)
        }
        GoalDto(
            id = goalId,
            name = goal.optString("name"),
            currentValue = currentValue,
            targetValue = targetValue,
            progress = progress,
        )
    }

    fun createGoal(name: String, targetValue: Double, currentValue: Double = 0.0): GoalDto {
        val stamp = now()
        val goalId = UUID.randomUUID().toString()
        val goals = bundle.optJSONArray("goals") ?: JSONArray().also { bundle.put("goals", it) }
        goals.put(
            JSONObject()
                .put("id", goalId)
                .put("workspaceId", workspace()?.id ?: "")
                .put("name", name)
                .put("folder", JSONObject.NULL)
                .put("ownerId", JSONObject.NULL)
                .put("periodType", "quarter")
                .put("periodStart", LocalDate.now().withDayOfMonth(1).toString())
                .put("periodEnd", LocalDate.now().plusMonths(3).toString())
                .put("status", "active")
                .put("progress", 0)
                .put("createdAt", stamp)
                .put("updatedAt", stamp),
        )
        val targets = bundle.optJSONArray("targets") ?: JSONArray().also { bundle.put("targets", it) }
        targets.put(
            JSONObject()
                .put("id", UUID.randomUUID().toString())
                .put("goalId", goalId)
                .put("name", name)
                .put("type", "number")
                .put("unit", JSONObject.NULL)
                .put("startValue", 0)
                .put("currentValue", currentValue)
                .put("targetValue", targetValue)
                .put("weight", 1)
                .put("progress", if (targetValue > 0) ((currentValue / targetValue) * 100).toInt() else 0),
        )
        log("هدف «$name» ساخته شد", "created", "goal", goalId)
        write()
        return goals().first { it.id == goalId }
    }

    fun updateGoal(goalId: String, currentValue: Double, targetValue: Double) {
        val target = objects("targets").firstOrNull { it.optString("goalId") == goalId } ?: return
        target.put("currentValue", currentValue)
        target.put("targetValue", targetValue)
        target.put(
            "progress",
            if (targetValue > 0) ((currentValue / targetValue) * 100).toInt().coerceIn(0, 100) else 0,
        )
        val goal = objects("goals").firstOrNull { it.optString("id") == goalId }
        goal?.put("progress", target.optInt("progress", 0))
        goal?.put("updatedAt", now())
        log("هدف «${goal?.optString("name") ?: ""}» به‌روزرسانی شد", "updated", "goal", goalId)
        write()
    }

    fun deleteGoal(goalId: String) {
        removeWhere("goals", "id", goalId)
        removeWhere("targets", "goalId", goalId)
        write()
    }

    // ---- Activity & stats ------------------------------------------------

    fun activity(limit: Int = 8): List<ActivityDto> = objects("activity")
        .sortedByDescending { it.optString("createdAt") }
        .take(limit)
        .map {
            ActivityDto(
                id = it.optString("id"),
                title = it.optString("title"),
                action = it.optString("action"),
                entityType = it.optString("entityType"),
                entityId = it.optString("entityId").takeIf { value -> value.isNotBlank() },
                createdAt = it.optString("createdAt"),
            )
        }

    fun stats(): StatsDto {
        val tasks = objects("tasks")
        val today = LocalDate.now().toString()
        val done = tasks.count {
            it.opt("completedAt")?.takeUnless { value -> value == JSONObject.NULL } != null
        }
        return StatsDto(
            totalTasks = tasks.size,
            openTasks = tasks.size - done,
            doneToday = tasks.count { it.optString("completedAt").startsWith(today) },
            dueToday = tasks.count {
                it.optString("dueDate").take(10) == today &&
                    it.opt("completedAt")?.takeUnless { value -> value == JSONObject.NULL } == null
            },
            overdue = tasks.count {
                val due = it.optString("dueDate").take(10)
                due.isNotBlank() && due != "null" && due < today &&
                    it.opt("completedAt")?.takeUnless { value -> value == JSONObject.NULL } == null
            },
            todayMinutes = todayMinutes(),
            spaces = objects("spaces").size,
            lists = objects("lists").size,
            goals = objects("goals").size,
        )
    }

    fun dueSoon(): List<TaskRowDto> {
        val today = LocalDate.now().toString()
        return objects("tasks")
            .filter {
                val due = it.optString("dueDate").take(10)
                val completed = it.opt("completedAt")?.takeUnless { value -> value == JSONObject.NULL }
                due.isNotBlank() && due != "null" && due <= today && completed == null
            }
            .sortedBy { it.optString("dueDate").take(10) }
            .map { toRow(it) }
    }

    fun search(query: String): List<TaskRowDto> = allTasks(query)

    // ---- Tags ------------------------------------------------------------

    fun tags(): List<TagDto> = objects("tags")
        .sortedBy { it.optString("name") }
        .map { TagDto(it.optString("id"), it.optString("name"), it.optString("color", "#6366f1")) }

    fun createTag(name: String, color: String = "#6366f1"): TagDto {
        val tags = bundle.optJSONArray("tags") ?: JSONArray().also { bundle.put("tags", it) }
        val item = JSONObject()
            .put("id", UUID.randomUUID().toString())
            .put("workspaceId", workspace()?.id ?: "")
            .put("name", name)
            .put("color", color)
        tags.put(item)
        log("برچسب «$name» ساخته شد", "created", "tag", item.optString("id"))
        write()
        return TagDto(item.optString("id"), name, color)
    }

    fun deleteTag(tagId: String) {
        removeWhere("tags", "id", tagId)
        removeWhere("taskTags", "tagId", tagId)
        write()
    }

    fun taskTags(taskId: String): List<TagDto> {
        val ids = objects("taskTags")
            .filter { it.optString("taskId") == taskId }
            .map { it.optString("tagId") }
            .toSet()
        if (ids.isEmpty()) return emptyList()
        return tags().filter { it.id in ids }
    }

    fun setTaskTags(taskId: String, tagIds: Set<String>) {
        val source = bundle.optJSONArray("taskTags") ?: JSONArray()
        val kept = JSONArray()
        for (index in 0 until source.length()) {
            val item = source.optJSONObject(index) ?: continue
            if (item.optString("taskId") != taskId) kept.put(item)
        }
        tagIds.forEach { tagId ->
            kept.put(JSONObject().put("taskId", taskId).put("tagId", tagId))
        }
        bundle.put("taskTags", kept)
        log("برچسب‌های کار به‌روزرسانی شد", "updated", "task", taskId)
        write()
    }

    // ---- Members (local, offline) ---------------------------------------

    fun members(): List<MemberDto> = objects("members").map {
        MemberDto(
            id = it.optString("id").ifBlank { it.optString("email") },
            name = it.optString("name").ifBlank { it.optString("email") },
            email = it.optString("email"),
            role = it.optString("role", "member"),
        )
    }

    fun createMember(name: String, email: String = "", role: String = "member"): MemberDto {
        val members = bundle.optJSONArray("members") ?: JSONArray().also { bundle.put("members", it) }
        val item = JSONObject()
            .put("id", UUID.randomUUID().toString())
            .put("name", name)
            .put("email", email.ifBlank { "local-${UUID.randomUUID().toString().take(8)}@karnameh.local" })
            .put("role", role)
        members.put(item)
        log("عضو «$name» اضافه شد", "created", "member", item.optString("id"))
        write()
        return MemberDto(
            id = item.optString("id"),
            name = name,
            email = item.optString("email"),
            role = role,
        )
    }

    fun deleteMember(memberId: String) {
        val member = members().firstOrNull { it.id == memberId }
        removeWhere("members", "id", memberId)
        if (member != null && member.email.isNotBlank()) {
            removeWhere("members", "email", member.email)
            removeWhere("assignees", "email", member.email)
        }
        removeWhere("assignees", "userId", memberId)
        write()
    }

    fun taskAssignees(taskId: String): List<MemberDto> {
        val entries = objects("assignees").filter { it.optString("taskId") == taskId }
        if (entries.isEmpty()) return emptyList()
        val ids = entries.map { it.optString("userId") }.toSet()
        val emails = entries.map { it.optString("email") }.filter { it.isNotBlank() }.toSet()
        return members().filter { it.id in ids || it.email in emails }
    }

    fun setTaskAssignees(taskId: String, memberIds: Set<String>) {
        val source = bundle.optJSONArray("assignees") ?: JSONArray()
        val kept = JSONArray()
        for (index in 0 until source.length()) {
            val item = source.optJSONObject(index) ?: continue
            if (item.optString("taskId") != taskId) kept.put(item)
        }
        val byId = members().associateBy { it.id }
        memberIds.forEach { memberId ->
            val member = byId[memberId] ?: return@forEach
            kept.put(
                JSONObject()
                    .put("taskId", taskId)
                    .put("userId", member.id)
                    .put("email", member.email)
                    .put("estimateMs", JSONObject.NULL),
            )
        }
        bundle.put("assignees", kept)
        log("مسئولان کار به‌روزرسانی شد", "updated", "task", taskId)
        write()
    }

    // ---- Custom fields ---------------------------------------------------

    fun fields(listId: String): List<FieldDto> = objects("fields")
        .filter { it.optString("listId") == listId }
        .sortedBy { it.optInt("position", 0) }
        .map { FieldDto(it.optString("id"), listId, it.optString("name"), it.optString("type", "text")) }

    fun createField(listId: String, name: String, type: String): FieldDto {
        val fields = bundle.optJSONArray("fields") ?: JSONArray().also { bundle.put("fields", it) }
        val item = JSONObject()
            .put("id", UUID.randomUUID().toString())
            .put("listId", listId)
            .put("name", name)
            .put("type", type)
            .put("config", JSONObject.NULL)
            .put("required", false)
            .put("position", objects("fields").count { it.optString("listId") == listId })
        fields.put(item)
        log("فیلد «$name» ساخته شد", "created", "field", item.optString("id"))
        write()
        return FieldDto(item.optString("id"), listId, name, type)
    }

    fun deleteField(fieldId: String) {
        removeWhere("fields", "id", fieldId)
        removeWhere("values", "fieldId", fieldId)
        write()
    }

    fun fieldValues(taskId: String): Map<String, String> = objects("values")
        .filter { it.optString("taskId") == taskId }
        .associate { it.optString("fieldId") to it.opt("value")?.toString().orEmpty() }

    fun setFieldValue(taskId: String, fieldId: String, value: String?) {
        val source = bundle.optJSONArray("values") ?: JSONArray()
        val kept = JSONArray()
        for (index in 0 until source.length()) {
            val item = source.optJSONObject(index) ?: continue
            if (item.optString("taskId") == taskId && item.optString("fieldId") == fieldId) continue
            kept.put(item)
        }
        if (!value.isNullOrBlank()) {
            kept.put(
                JSONObject()
                    .put("id", UUID.randomUUID().toString())
                    .put("fieldId", fieldId)
                    .put("taskId", taskId)
                    .put("value", value),
            )
        }
        bundle.put("values", kept)
        write()
    }

    // ---- Saved views -----------------------------------------------------

    fun views(listId: String): List<SavedViewDto> = objects("views")
        .filter { it.optString("listId") == listId }
        .map {
            SavedViewDto(
                id = it.optString("id"),
                listId = listId,
                name = it.optString("name"),
                configJson = it.optString("config", "{}"),
                isDefault = it.optBoolean("isDefault", false),
            )
        }

    fun saveView(listId: String, name: String, configJson: String): SavedViewDto {
        val views = bundle.optJSONArray("views") ?: JSONArray().also { bundle.put("views", it) }
        val item = JSONObject()
            .put("id", UUID.randomUUID().toString())
            .put("listId", listId)
            .put("name", name)
            .put("config", configJson)
            .put("isDefault", false)
        views.put(item)
        write()
        return SavedViewDto(item.optString("id"), listId, name, configJson, false)
    }

    fun deleteView(viewId: String) {
        removeWhere("views", "id", viewId)
        write()
    }

    fun setDefaultView(listId: String, viewId: String?) {
        val source = bundle.optJSONArray("views") ?: return
        for (index in 0 until source.length()) {
            val item = source.optJSONObject(index) ?: continue
            if (item.optString("listId") == listId) {
                item.put("isDefault", item.optString("id") == viewId)
            }
        }
        write()
    }

    // ---- Focus sessions --------------------------------------------------

    fun focusSessions(): List<FocusSessionDto> = objects("focusSessions")
        .sortedByDescending { it.optString("startedAt") }
        .map {
            val taskId = stringOrNull(it, "taskId")
            FocusSessionDto(
                id = it.optString("id"),
                mode = it.optString("mode", "focus"),
                seconds = it.optInt("seconds", 0),
                completed = it.optBoolean("completed", true),
                startedAt = it.optString("startedAt"),
                taskTitle = taskId?.let { id -> findTask(id)?.optString("title") },
            )
        }

    fun todayFocusMinutes(): Int = objects("focusSessions")
        .filter { it.optString("startedAt").startsWith(LocalDate.now().toString()) }
        .sumOf { it.optInt("seconds", 0) } / 60

    fun recordFocusSession(
        mode: String,
        taskId: String?,
        seconds: Int,
        completed: Boolean,
    ) {
        val sessions = bundle.optJSONArray("focusSessions") ?: JSONArray().also {
            bundle.put("focusSessions", it)
        }
        val stamp = now()
        val safeSeconds = seconds.coerceAtLeast(0)
        sessions.put(
            JSONObject()
                .put("id", UUID.randomUUID().toString())
                .put("mode", mode)
                .put("taskId", taskId ?: JSONObject.NULL)
                .put("seconds", safeSeconds)
                .put("completed", completed)
                .put("startedAt", stamp)
                .put("endedAt", stamp),
        )
        // A finished focus session is also real work time, so it must appear in
        // the task's worked time and in the time log, not only in focus history.
        if (safeSeconds > 0) {
            val entries = bundle.optJSONArray("timeEntries") ?: JSONArray().also {
                bundle.put("timeEntries", it)
            }
            val minutes = (safeSeconds / 60).coerceAtLeast(1)
            val entryId = UUID.randomUUID().toString()
            entries.put(
                JSONObject()
                    .put("id", entryId)
                    .put("taskId", taskId ?: JSONObject.NULL)
                    .put("description", if (taskId == null) "تمرکز آزاد" else "جلسهٔ تمرکز")
                    .put("durationMinutes", minutes)
                    .put("billable", false)
                    .put("spentOn", LocalDate.now().toString())
                    .put("createdAt", stamp),
            )
            log("$minutes دقیقه زمان ثبت شد", "time_logged", "time", entryId)
        }
        log(
            "جلسهٔ تمرکز ثبت شد (${safeSeconds / 60} دقیقه)",
            "focus",
            "focus",
            mode,
        )
        write()
    }

    // ---- Local automations ----------------------------------------------

    fun automations(): List<AutomationDto> = objects("automations").map { item ->
        val trigger = item.optJSONObject("trigger")
        val condition = item.optJSONObject("conditions")
            ?.optJSONArray("items")
            ?.optJSONObject(0)
        val action = item.optJSONArray("actions")?.optJSONObject(0)
        val params = action?.optJSONObject("params")
        val rawTriggerTo = trigger?.optString("to").orEmpty()
        val triggerTo = statusName(rawTriggerTo)
        val rawActionType = action?.optString("type") ?: "task.set_priority"
        val actionType = when (rawActionType) {
            "task.set_priority" -> "priority"
            "task.set_status" -> "status"
            "task.assign" -> "assign"
            "time.start" -> "time"
            else -> rawActionType
        }
        val actionValue = when (actionType) {
            "status" -> statusName(params?.optString("statusId").orEmpty().ifBlank {
                params?.optString("value").orEmpty()
            })
            "assign" -> memberName(params?.optString("userId").orEmpty().ifBlank {
                params?.optString("value").orEmpty()
            })
            "time" -> "auto"
            else -> params?.optString("value").orEmpty()
        }
        AutomationDto(
            id = item.optString("id"),
            name = item.optString("name"),
            enabled = item.optBoolean("enabled", true),
            triggerType = trigger?.optString("type") ?: "task.created",
            triggerTo = triggerTo,
            conditionPriority = condition?.optString("value").orEmpty(),
            actionType = actionType,
            actionValue = actionValue,
        )
    }

    private fun statusName(value: String): String {
        if (value.isBlank()) return ""
        return objects("statuses").firstOrNull { it.optString("id") == value }
            ?.optString("name") ?: value
    }

    private fun memberName(value: String): String {
        if (value.isBlank()) return ""
        return members().firstOrNull {
            it.id == value || it.email == value || it.name == value
        }?.name ?: value
    }

    fun createAutomation(
        name: String,
        triggerType: String,
        triggerTo: String,
        conditionPriority: String,
        actionType: String,
        actionValue: String,
    ) {
        val automations = bundle.optJSONArray("automations") ?: JSONArray().also {
            bundle.put("automations", it)
        }
        val item = JSONObject()
            .put("id", UUID.randomUUID().toString())
            .put("workspaceId", workspace()?.id ?: "")
            .put("name", name)
            .put("enabled", true)
            .put(
                "trigger",
                JSONObject()
                    .put("type", triggerType)
                    .put("to", triggerTo.ifBlank { JSONObject.NULL }),
            )
            .put(
                "conditions",
                JSONObject().put(
                    "items",
                    JSONArray().apply {
                        if (conditionPriority.isNotBlank()) {
                            put(
                                JSONObject()
                                    .put("field", "priority")
                                    .put("operator", "equals")
                                    .put("value", conditionPriority),
                            )
                        }
                    },
                ),
            )
            .put(
                "actions",
                JSONArray().put(
                    JSONObject()
                        .put("type", actionType)
                        .put("params", JSONObject().put("value", actionValue)),
                ),
            )
            .put("runAs", "local")
        automations.put(item)
        log("اتوماسیون «$name» ساخته شد", "created", "automation", item.optString("id"))
        write()
    }

    fun toggleAutomation(automationId: String, enabled: Boolean) {
        val item = objects("automations").firstOrNull { it.optString("id") == automationId } ?: return
        item.put("enabled", enabled)
        write()
    }

    fun deleteAutomation(automationId: String) {
        removeWhere("automations", "id", automationId)
        write()
    }

    fun automationRuns(limit: Int = 10): List<String> = objects("automationRuns")
        .sortedByDescending { it.optString("createdAt") }
        .take(limit)
        .map { it.optString("name") + " · " + it.optString("triggerType") }

    // ---- Dashboard aggregates -------------------------------------------

    fun statusBreakdown(): List<NamedCount> {
        val tasks = objects("tasks")
        return objects("statuses")
            .groupBy { it.optString("id") }
            .mapNotNull { (id, list) ->
                val status = list.firstOrNull() ?: return@mapNotNull null
                val count = tasks.count { it.optString("statusId") == id }
                if (count == 0) null else NamedCount(
                    id = id,
                    label = status.optString("name"),
                    color = status.optString("color", "#94a3b8"),
                    count = count,
                )
            }
    }

    fun priorityBreakdown(): List<NamedCount> {
        val tasks = objects("tasks")
        return listOf("urgent", "high", "normal", "low", "none").map { priority ->
            NamedCount(
                id = priority,
                label = when (priority) {
                    "urgent" -> "فوری"
                    "high" -> "زیاد"
                    "normal" -> "معمولی"
                    "low" -> "کم"
                    else -> "بدون اولویت"
                },
                color = when (priority) {
                    "urgent" -> "#ef4444"
                    "high" -> "#f97316"
                    "normal" -> "#3b82f6"
                    "low" -> "#22c55e"
                    else -> "#94a3b8"
                },
                count = tasks.count { it.optString("priority", "none") == priority },
            )
        }.filter { it.count > 0 }
    }

    fun last7DaysMinutes(): List<DayMinutes> {
        val entries = objects("timeEntries")
        val focus = objects("focusSessions")
        val today = LocalDate.now()
        return (6 downTo 0).map { offset ->
            val date = today.minusDays(offset.toLong()).toString()
            val logged = entries.filter { it.optString("spentOn") == date }
                .sumOf { it.optInt("durationMinutes", 0) }
            val focused = focus.filter { it.optString("startedAt").startsWith(date) }
                .sumOf { it.optInt("seconds", 0) } / 60
            DayMinutes(date = date, minutes = logged + focused)
        }
    }

    fun workload(): List<WorkloadRow> {
        val activeTasks = objects("tasks").filter {
            it.opt("completedAt")?.takeUnless { value -> value == JSONObject.NULL } == null
        }
        val assignees = objects("assignees")
        return members().map { member ->
            val assigned = activeTasks.filter { task ->
                val taskId = task.optString("id")
                assignees.any {
                    it.optString("taskId") == taskId &&
                        (it.optString("userId") == member.id || it.optString("email") == member.email)
                }
            }
            WorkloadRow(
                memberId = member.id,
                name = member.name,
                openTasks = assigned.size,
                estimateMinutes = assigned.sumOf { longOrNull(it, "estimateMs") ?: 0L } / 60_000L,
            )
        }.sortedByDescending { it.openTasks }
    }

    // ---- Attachments -----------------------------------------------------

    fun attachments(taskId: String): List<AttachmentDto> = objects("attachments")
        .filter { it.optString("taskId") == taskId }
        .sortedByDescending { it.optString("createdAt") }
        .map {
            AttachmentDto(
                id = it.optString("id"),
                taskId = it.optString("taskId"),
                name = it.optString("name"),
                fileName = it.optString("fileName"),
                mimeType = it.optString("mimeType", "application/octet-stream"),
                size = it.optLong("size", 0L),
            )
        }

    fun addAttachment(
        taskId: String,
        name: String,
        fileName: String,
        mimeType: String,
        size: Long,
    ): AttachmentDto {
        val items = bundle.optJSONArray("attachments") ?: JSONArray().also {
            bundle.put("attachments", it)
        }
        val item = JSONObject()
            .put("id", UUID.randomUUID().toString())
            .put("taskId", taskId)
            .put("name", name)
            .put("fileName", fileName)
            .put("mimeType", mimeType)
            .put("size", size)
            .put("createdAt", now())
        items.put(item)
        log("پیوست «$name» اضافه شد", "created", "attachment", item.optString("id"))
        write()
        return AttachmentDto(
            item.optString("id"),
            taskId,
            name,
            fileName,
            mimeType,
            size,
        )
    }

    fun deleteAttachment(attachmentId: String): String? {
        val fileName = objects("attachments")
            .firstOrNull { it.optString("id") == attachmentId }
            ?.optString("fileName")
        removeWhere("attachments", "id", attachmentId)
        write()
        return fileName
    }

    // ---- Import / export / reset ----------------------------------------

    fun exportJson(): String {
        bundle.put("exportedAt", now())
        write()
        return bundle.toString(2)
    }

    fun isValidBundle(text: String): Boolean = runCatching {
        val parsed = JSONObject(text)
        parsed.optString("format") == "karnameh-export" && parsed.optJSONObject("workspace") != null
    }.getOrDefault(false)

    fun importJson(text: String) {
        val parsed = JSONObject(text)
        require(parsed.optString("format") == "karnameh-export") {
            "فایل انتخابی یک بستهٔ کارنامه نیست."
        }
        require(parsed.optJSONObject("workspace") != null) {
            "این بسته میزکار ندارد."
        }
        bundle = ensureShape(parsed)
        write()
    }

    fun reset() {
        bundle = starter()
        write()
    }

    /**
     * Re-read the JSON file from disk. The focus timer writes through its own
     * [OfflineStore] instance (from the activity or the foreground service), so
     * the UI instance must refresh before the next render; otherwise the newly
     * recorded time entry is invisible until the app restarts.
     */
    fun reload() {
        if (!file.exists()) return
        runCatching { JSONObject(file.readText(Charsets.UTF_8)) }
            .getOrNull()
            ?.takeIf { it.optString("format") == "karnameh-export" }
            ?.let { bundle = ensureShape(it) }
    }

    // ---- Internals -------------------------------------------------------

    private fun objects(key: String): List<JSONObject> {
        val array = bundle.optJSONArray(key) ?: return emptyList()
        return (0 until array.length()).mapNotNull { array.optJSONObject(it) }
    }

    private fun findTask(taskId: String): JSONObject? =
        objects("tasks").firstOrNull { it.optString("id") == taskId }

    private fun matchesQuery(task: JSONObject, query: String?): Boolean {
        val text = query?.trim()
        if (text.isNullOrBlank()) return true
        val haystack = task.optString("title") + " " + task.optString("description")
        return normalize(haystack).contains(normalize(text))
    }

    private fun normalize(value: String): String = value
        .replace('ي', 'ی')
        .replace('ك', 'ک')
        .replace('\u200c', ' ')
        .lowercase()

    private fun toRow(
        task: JSONObject,
        worked: Map<String, Int> = workedMinutesByTask(),
    ): TaskRowDto {
        val taskId = task.optString("id")
        return TaskRowDto(
            id = taskId,
            title = task.optString("title"),
            statusId = task.optString("statusId"),
            priority = task.optString("priority", "none"),
            dueDate = stringOrNull(task, "dueDate")?.take(10),
            completedAt = stringOrNull(task, "completedAt"),
            listId = task.optString("listId"),
            startDate = stringOrNull(task, "startDate")?.take(10),
            startTime = stringOrNull(task, "startTime")?.take(5),
            dueTime = stringOrNull(task, "dueTime")?.take(5),
            estimateMs = longOrNull(task, "estimateMs"),
            workedMinutes = worked[taskId] ?: 0,
            done = isDoneStatus(task.optString("statusId")),
            tags = taskTags(taskId),
            assignees = taskAssignees(taskId),
        )
    }

    private fun toFull(task: JSONObject): TaskFullDto {
        val taskId = task.optString("id")
        return TaskFullDto(
            id = taskId,
            listId = task.optString("listId"),
            title = task.optString("title"),
            description = stringOrNull(task, "description"),
            statusId = task.optString("statusId"),
            priority = task.optString("priority", "none"),
            startDate = stringOrNull(task, "startDate")?.take(10),
            startTime = stringOrNull(task, "startTime")?.take(5),
            dueDate = stringOrNull(task, "dueDate")?.take(10),
            dueTime = stringOrNull(task, "dueTime")?.take(5),
            estimateMs = longOrNull(task, "estimateMs"),
            workedMinutes = workedMinutesByTask()[taskId] ?: 0,
            done = isDoneStatus(task.optString("statusId")),
            parentTaskId = stringOrNull(task, "parentTaskId"),
            completedAt = stringOrNull(task, "completedAt"),
        )
    }

    private fun isDoneStatus(statusId: String): Boolean {
        val type = objects("statuses")
            .firstOrNull { it.optString("id") == statusId }
            ?.optString("type")
        return type == "done" || type == "closed"
    }

    private fun workedMinutesByTask(): Map<String, Int> {
        // Old manual entries (before the task picker) stored the task title only in
        // `description`; attribute those by an exact title match so historic work
        // still counts toward the task.
        val titleToTask = objects("tasks").associate {
            normalize(it.optString("title")) to it.optString("id")
        }
        val totals = mutableMapOf<String, Int>()
        for (entry in objects("timeEntries")) {
            val description = stringOrNull(entry, "description")
            val taskId = stringOrNull(entry, "taskId")
                ?: description?.let { titleToTask[normalize(it)] }
                ?: continue
            totals[taskId] = (totals[taskId] ?: 0) + entry.optInt("durationMinutes", 0)
        }
        return totals
    }

    private fun toTimeEntry(entry: JSONObject): TimeEntryDto {
        val taskId = stringOrNull(entry, "taskId")
        return TimeEntryDto(
            id = entry.optString("id"),
            taskId = taskId,
            taskTitle = taskId?.let { findTask(it)?.optString("title") },
            description = stringOrNull(entry, "description"),
            minutes = entry.optInt("durationMinutes", 0),
            spentOn = entry.optString("spentOn"),
        )
    }

    private fun stringOrNull(json: JSONObject, key: String): String? =
        json.opt(key)?.takeUnless { it == JSONObject.NULL }?.toString()?.takeIf { it.isNotBlank() }

    private fun longOrNull(json: JSONObject, key: String): Long? =
        json.opt(key)?.takeUnless { it == JSONObject.NULL }?.let {
            (it as? Number)?.toLong() ?: it.toString().toLongOrNull()
        }

    private fun removeWhere(arrayKey: String, field: String, value: String) {
        val source = bundle.optJSONArray(arrayKey) ?: return
        val kept = JSONArray()
        for (index in 0 until source.length()) {
            val item = source.optJSONObject(index) ?: continue
            if (item.optString(field) == value) continue
            kept.put(item)
        }
        bundle.put(arrayKey, kept)
    }

    private fun log(title: String, action: String, entityType: String, entityId: String) {
        val activity = bundle.optJSONArray("activity") ?: JSONArray().also {
            bundle.put("activity", it)
        }
        activity.put(
            JSONObject()
                .put("id", UUID.randomUUID().toString())
                .put("title", title)
                .put("action", action)
                .put("entityType", entityType)
                .put("entityId", entityId)
                .put("createdAt", now()),
        )
        while (activity.length() > 200) {
            val trimmed = JSONArray()
            for (index in 1 until activity.length()) trimmed.put(activity.get(index))
            bundle.put("activity", trimmed)
            break
        }
    }

    private fun runAutomations(
        event: String,
        taskId: String,
        newStatusName: String?,
        depth: Int,
    ) {
        if (depth > 2) return
        val rules = automations().filter { it.enabled }
        if (rules.isEmpty()) return
        val task = findTask(taskId) ?: return
        val statusNames = objects("statuses").associate { it.optString("id") to it.optString("name") }
        var statusChanged = false

        for (rule in rules) {
            if (rule.triggerType != event) continue
            if (
                event == "task.status_changed" &&
                rule.triggerTo.isNotBlank() &&
                rule.triggerTo != newStatusName &&
                rule.triggerTo != statusNames[task.optString("statusId")]
            ) {
                continue
            }
            if (rule.conditionPriority.isNotBlank() && task.optString("priority") != rule.conditionPriority) {
                continue
            }

            var applied = false
            when (rule.actionType) {
                "priority" -> {
                    if (rule.actionValue.isNotBlank() && task.optString("priority") != rule.actionValue) {
                        task.put("priority", rule.actionValue)
                        applied = true
                    }
                }

                "status" -> {
                    val status = objects("statuses").firstOrNull {
                        it.optString("listId") == task.optString("listId") &&
                            it.optString("name") == rule.actionValue
                    }
                    if (status != null && status.optString("id") != task.optString("statusId")) {
                        task.put("statusId", status.optString("id"))
                        val done = status.optString("type") == "done" ||
                            status.optString("type") == "closed"
                        task.put("completedAt", if (done) now() else JSONObject.NULL)
                        statusChanged = true
                        applied = true
                    }
                }

                "tag" -> {
                    if (rule.actionValue.isNotBlank()) {
                        val tag = objects("tags").firstOrNull { it.optString("name") == rule.actionValue }
                            ?: createLocalTag(rule.actionValue)
                        addTaskTag(taskId, tag.optString("id"))
                        applied = true
                    }
                }

                "assign" -> {
                    val member = members().firstOrNull { it.name == rule.actionValue }
                    if (member != null) {
                        addAssignee(taskId, member)
                        applied = true
                    }
                }

                "time" -> {
                    bundle.put(
                        "activeTimer",
                        JSONObject().put("taskId", taskId).put("startedAt", now()),
                    )
                    applied = true
                }
            }

            if (applied) {
                task.put("updatedAt", now())
                recordAutomationRun(rule, event)
            }
        }

        if (statusChanged) {
            runAutomations(
                "task.status_changed",
                taskId,
                statusNames[task.optString("statusId")],
                depth + 1,
            )
        }
    }

    private fun createLocalTag(name: String): JSONObject {
        val tags = bundle.optJSONArray("tags") ?: JSONArray().also { bundle.put("tags", it) }
        val tag = JSONObject()
            .put("id", UUID.randomUUID().toString())
            .put("workspaceId", workspace()?.id ?: "")
            .put("name", name)
            .put("color", "#8b5cf6")
        tags.put(tag)
        return tag
    }

    private fun addTaskTag(taskId: String, tagId: String) {
        if (objects("taskTags").any {
                it.optString("taskId") == taskId && it.optString("tagId") == tagId
            }
        ) {
            return
        }
        val entries = bundle.optJSONArray("taskTags") ?: JSONArray().also {
            bundle.put("taskTags", it)
        }
        entries.put(JSONObject().put("taskId", taskId).put("tagId", tagId))
    }

    private fun addAssignee(taskId: String, member: MemberDto) {
        if (objects("assignees").any {
                it.optString("taskId") == taskId &&
                    (it.optString("userId") == member.id || it.optString("email") == member.email)
            }
        ) {
            return
        }
        val entries = bundle.optJSONArray("assignees") ?: JSONArray().also {
            bundle.put("assignees", it)
        }
        entries.put(
            JSONObject()
                .put("taskId", taskId)
                .put("userId", member.id)
                .put("email", member.email)
                .put("estimateMs", JSONObject.NULL),
        )
    }

    private fun recordAutomationRun(rule: AutomationDto, trigger: String) {
        val runs = bundle.optJSONArray("automationRuns") ?: JSONArray().also {
            bundle.put("automationRuns", it)
        }
        runs.put(
            JSONObject()
                .put("id", UUID.randomUUID().toString())
                .put("automationId", rule.id)
                .put("name", rule.name)
                .put("status", "success")
                .put("triggerType", trigger)
                .put("createdAt", now()),
        )
        log("اتوماسیون «${rule.name}» اجرا شد", "automation_run", "automation", rule.id)
    }

    private fun write(data: JSONObject = bundle) {
        val text = data.toString(2)
        val temp = File(file.parentFile, "karnameh.json.tmp")
        temp.writeText(text, Charsets.UTF_8)
        if (file.exists() && !file.delete()) {
            file.writeText(text, Charsets.UTF_8)
            temp.delete()
            return
        }
        if (!temp.renameTo(file)) {
            file.writeText(text, Charsets.UTF_8)
            temp.delete()
        }
    }

    private fun readOrCreate(): JSONObject {
        if (file.exists()) {
            runCatching { JSONObject(file.readText(Charsets.UTF_8)) }
                .getOrNull()
                ?.takeIf { it.optString("format") == "karnameh-export" }
                ?.let { return ensureShape(it) }
        }
        seedBundle()?.let {
            write(it)
            return it
        }
        val fresh = starter()
        write(fresh)
        return fresh
    }

    /** First launch only: ship a local seed bundle inside the APK. */
    private fun seedBundle(): JSONObject? = runCatching {
        context.assets.open(SEED_ASSET)
            .bufferedReader(Charsets.UTF_8)
            .use { it.readText() }
    }.getOrNull()
        ?.let { runCatching { JSONObject(it) }.getOrNull() }
        ?.takeIf { it.optString("format") == "karnameh-export" }
        ?.let { ensureShape(it) }

    private fun ensureShape(source: JSONObject): JSONObject {
        for (key in ARRAY_KEYS) {
            if (!source.has(key) || source.optJSONArray(key) == null) {
                source.put(key, JSONArray())
            }
        }
        if (!source.has("exportedAt")) source.put("exportedAt", now())
        if (!source.has("version")) source.put("version", 1)
        return source
    }

    private fun starter(): JSONObject {
        val workspaceId = UUID.randomUUID().toString()
        val spaceId = UUID.randomUUID().toString()
        val listId = UUID.randomUUID().toString()
        val timestamp = now()

        val result = JSONObject()
            .put("format", "karnameh-export")
            .put("version", 1)
            .put("exportedAt", timestamp)
            .put(
                "workspace",
                JSONObject()
                    .put("id", workspaceId)
                    .put("name", "میزکار من")
                    .put("slug", "my-workspace")
                    .put("defaultLocale", "fa")
                    .put("currency", "IRR")
                    .put("hourlyRate", JSONObject.NULL)
                    .put("createdAt", timestamp)
                    .put("updatedAt", timestamp),
            )

        for (key in ARRAY_KEYS) result.put(key, JSONArray())

        result.put(
            "members",
            JSONArray().put(
                JSONObject()
                    .put("id", UUID.randomUUID().toString())
                    .put("name", "من")
                    .put("email", "me@karnameh.local")
                    .put("role", "owner"),
            ),
        )

        result.put(
            "spaces",
            JSONArray().put(
                JSONObject()
                    .put("id", spaceId)
                    .put("workspaceId", workspaceId)
                    .put("name", "عمومی")
                    .put("color", "#0f766e")
                    .put("position", 0)
                    .put("createdAt", timestamp)
                    .put("updatedAt", timestamp),
            ),
        )
        result.put(
            "lists",
            JSONArray().put(
                JSONObject()
                    .put("id", listId)
                    .put("spaceId", spaceId)
                    .put("folderId", JSONObject.NULL)
                    .put("name", "کارها")
                    .put("position", 0)
                    .put("createdAt", timestamp)
                    .put("updatedAt", timestamp),
            ),
        )
        result.put(
            "statuses",
            JSONArray()
                .put(status(listId, "برای انجام", "open", "#94a3b8", 0))
                .put(status(listId, "در حال انجام", "custom", "#3b82f6", 1))
                .put(status(listId, "انجام شد", "done", "#22c55e", 2)),
        )
        return result
    }

    private fun status(
        listId: String,
        name: String,
        type: String,
        color: String,
        position: Int,
    ): JSONObject = JSONObject()
        .put("id", UUID.randomUUID().toString())
        .put("listId", listId)
        .put("name", name)
        .put("type", type)
        .put("color", color)
        .put("position", position)

    private fun now(): String = Instant.now().toString()

    private companion object {
        const val SEED_ASSET = "karnameh-seed.json"

        val ARRAY_KEYS = listOf(
            "members",
            "spaces",
            "folders",
            "lists",
            "statuses",
            "tasks",
            "fields",
            "values",
            "assignees",
            "tags",
            "taskTags",
            "dependencies",
            "goals",
            "targets",
            "targetTasks",
            "dashboards",
            "automations",
            "timeEntries",
            "timesheets",
            "activity",
            "views",
            "focusSessions",
            "automationRuns",
            "attachments",
        )
    }
}
