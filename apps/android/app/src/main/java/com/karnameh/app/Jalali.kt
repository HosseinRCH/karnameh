package com.karnameh.app

import java.time.LocalDate

/** Jalali (Shamsi) <-> Gregorian conversion (standard jalaali algorithm). */
object Jalali {
    val MONTHS = listOf(
        "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
        "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
    )
    val WEEK_DAYS = listOf("ش", "ی", "د", "س", "چ", "پ", "ج")

    private fun div(a: Int, b: Int): Int = a / b
    private fun mod(a: Int, b: Int): Int = a % b

    private fun g2d(gy: Int, gm: Int, gd: Int): Int {
        var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
            div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408
        d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
        return d
    }

    private fun d2g(jdn: Int): Triple<Int, Int, Int> {
        var j = 4 * jdn + 139361631
        j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
        val i = div(mod(j, 1461), 4) * 5 + 308
        val gd = div(mod(i, 153), 5) + 1
        val gm = mod(div(i, 153), 12) + 1
        val gy = div(j, 1461) - 100100 + div(8 - gm, 6)
        return Triple(gy, gm, gd)
    }

    private val BREAKS = intArrayOf(
        -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262,
        2324, 2394, 2456, 3178,
    )

    private fun jalCal(jy: Int, withoutLeap: Boolean): Triple<Int, Int, Int> {
        val bl = BREAKS.size
        val gy = jy + 621
        var leapJ = -14
        var jp = BREAKS[0]
        var jm = 0
        var jump = 0
        require(jy >= jp && jy < BREAKS[bl - 1]) { "Invalid Jalali year $jy" }
        for (i in 1 until bl) {
            jm = BREAKS[i]
            jump = jm - jp
            if (jy < jm) break
            leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4)
            jp = jm
        }
        var n = jy - jp
        leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4)
        if (mod(jump, 33) == 4 && jump - n == 4) leapJ += 1
        val leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
        val march = 20 + leapJ - leapG
        var leap = 0
        if (!withoutLeap) {
            if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33
            leap = mod(mod(n + 1, 33) - 1, 4)
            if (leap == -1) leap = 4
        }
        return Triple(leap, gy, march)
    }

    private fun j2d(jy: Int, jm: Int, jd: Int): Int {
        val r = jalCal(jy, true)
        return g2d(r.second, 3, r.third) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1
    }

    private fun d2j(jdn: Int): Triple<Int, Int, Int> {
        val gy = d2g(jdn).first
        var jy = gy - 621
        val r = jalCal(jy, false)
        val jdn1f = g2d(gy, 3, r.third)
        var k = jdn - jdn1f
        if (k >= 0) {
            if (k <= 185) return Triple(jy, 1 + div(k, 31), mod(k, 31) + 1)
            k -= 186
        } else {
            jy -= 1
            k += 179
            if (r.first == 1) k += 1
        }
        return Triple(jy, 7 + div(k, 30), mod(k, 30) + 1)
    }

    fun toJalali(gy: Int, gm: Int, gd: Int): Triple<Int, Int, Int> = d2j(g2d(gy, gm, gd))

    fun toGregorian(jy: Int, jm: Int, jd: Int): Triple<Int, Int, Int> = d2g(j2d(jy, jm, jd))

    fun jalaaliToIso(jy: Int, jm: Int, jd: Int): String {
        val (gy, gm, gd) = toGregorian(jy, jm, jd)
        return "%04d-%02d-%02d".format(gy, gm, gd)
    }

    fun isoToJalali(iso: String): Triple<Int, Int, Int> {
        val date = LocalDate.parse(iso)
        return toJalali(date.year, date.monthValue, date.dayOfMonth)
    }

    fun today(): Triple<Int, Int, Int> {
        val now = LocalDate.now()
        return toJalali(now.year, now.monthValue, now.dayOfMonth)
    }

    fun daysInMonth(jy: Int, jm: Int): Int {
        val next = if (jm == 12) Triple(jy + 1, 1, 1) else Triple(jy, jm + 1, 1)
        val a = LocalDate.parse(jalaaliToIso(jy, jm, 1)).toEpochDay()
        val b = LocalDate.parse(jalaaliToIso(next.first, next.second, next.third)).toEpochDay()
        return (b - a).toInt()
    }

    fun firstWeekday(jy: Int, jm: Int): Int {
        val iso = jalaaliToIso(jy, jm, 1)
        // Saturday = 0
        return (LocalDate.parse(iso).dayOfWeek.value + 1) % 7
    }

    fun monthLabel(jy: Int, jm: Int): String = "${MONTHS[jm - 1]} $jy"

    fun formatIso(iso: String?): String {
        if (iso.isNullOrBlank() || iso == "null") return "—"
        return runCatching {
            val (jy, jm, jd) = isoToJalali(iso)
            "%04d/%02d/%02d".format(jy, jm, jd)
        }.getOrDefault(iso)
    }
}
