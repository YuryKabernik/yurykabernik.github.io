---
icon: fas fa-calendar-week
order: 1
---

{% assign weeklies = site.weeklies | sort: "date" | reverse %}

{% for weekly in weeklies %}
- [{{ weekly.title }}]({{ weekly.url | relative_url }}){% if weekly.description %} — {{ weekly.description }}{% endif %}
{% endfor %}
