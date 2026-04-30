from __future__ import annotations


DEFAULT_PLACE = "Philippines"

PUBLIC_INTELLIGENCE_CATEGORIES = [
    "Governance & Public Services",
    "Economy, Prices & Livelihood",
    "Transportation & Infrastructure",
    "Public Safety & Security",
    "Health & Social Welfare",
    "Education",
    "Disaster, Climate & Environment",
    "Energy & Utilities",
]

DEFAULT_PRIORITIZED_CATEGORIES = [
    "Governance & Public Services",
    "Transportation & Infrastructure",
    "Disaster, Climate & Environment",
]

SUPPORTED_PHILIPPINE_LOCATIONS = [
    "Philippines",
    "NCR",
    "Luzon",
    "Visayas",
    "Mindanao",
    "Metro Manila",
    "Manila",
    "Quezon City",
    "Makati City",
    "Pasig City",
    "Taguig City",
    "Baguio City",
    "Cebu City",
    "Davao City",
    "Iloilo City",
    "Bacolod City",
    "Cagayan de Oro City",
    "Zamboanga City",
    "General Santos City",
    "Angeles City",
    "Naga City",
    "Legazpi City",
    "Tacloban City",
    "Cebu Province",
    "Cavite",
    "Laguna",
    "Batangas",
    "Rizal",
    "Bulacan",
    "Pangasinan",
    "Pampanga",
    "Albay",
    "Leyte",
    "Iloilo Province",
    "Davao del Sur",
]

_PLACE_ALIASES = {
    "national": "Philippines",
    "ph": "Philippines",
    "republic of the philippines": "Philippines",
    "metro manila": "NCR",
    "national capital region": "NCR",
}

_CATEGORY_ALIASES = {
    "governance": "Governance & Public Services",
    "public services": "Governance & Public Services",
    "government": "Governance & Public Services",
    "economy": "Economy, Prices & Livelihood",
    "prices": "Economy, Prices & Livelihood",
    "livelihood": "Economy, Prices & Livelihood",
    "inflation": "Economy, Prices & Livelihood",
    "transportation": "Transportation & Infrastructure",
    "transport": "Transportation & Infrastructure",
    "infrastructure": "Transportation & Infrastructure",
    "public safety": "Public Safety & Security",
    "security": "Public Safety & Security",
    "crime": "Public Safety & Security",
    "health": "Health & Social Welfare",
    "social welfare": "Health & Social Welfare",
    "welfare": "Health & Social Welfare",
    "education": "Education",
    "schools": "Education",
    "disaster": "Disaster, Climate & Environment",
    "climate": "Disaster, Climate & Environment",
    "environment": "Disaster, Climate & Environment",
    "environmental": "Disaster, Climate & Environment",
    "energy": "Energy & Utilities",
    "utilities": "Energy & Utilities",
    "power": "Energy & Utilities",
    "water": "Energy & Utilities",
}

_CATEGORY_BY_KEY = {
    category.casefold(): category for category in PUBLIC_INTELLIGENCE_CATEGORIES
}

_PLACE_BY_KEY = {place.casefold(): place for place in SUPPORTED_PHILIPPINE_LOCATIONS}


def normalize_place(value: str | None) -> str:
    cleaned = " ".join(str(value or DEFAULT_PLACE).split())
    key = cleaned.casefold()
    if key in _PLACE_ALIASES:
        return _PLACE_ALIASES[key]
    if key in _PLACE_BY_KEY:
        return _PLACE_BY_KEY[key]
    if "philippines" in key:
        return cleaned
    raise ValueError(
        "SALINIG v1 is Philippines-first. Use Philippines, a supported Philippine region, "
        "or a configured Philippine city/province."
    )


def normalize_categories(values: list[str] | tuple[str, ...] | None) -> list[str]:
    raw_values = list(values or DEFAULT_PRIORITIZED_CATEGORIES)
    normalized = []
    seen = set()
    for raw in raw_values:
        cleaned = " ".join(str(raw).split())
        key = cleaned.casefold()
        category = _CATEGORY_BY_KEY.get(key) or _CATEGORY_ALIASES.get(key)
        if not category:
            raise ValueError(
                f"Unknown public-intelligence category '{cleaned}'. Use one of the fixed "
                "SALINIG v1 categories, and put free-form details in focus_terms."
            )
        category_key = category.casefold()
        if category_key in seen:
            continue
        seen.add(category_key)
        normalized.append(category)
    return normalized or list(DEFAULT_PRIORITIZED_CATEGORIES)


def dedupe_focus_terms(values: list[str] | tuple[str, ...] | None) -> list[str]:
    deduped = []
    seen = set()
    for raw in values or []:
        cleaned = " ".join(str(raw).split())
        if not cleaned:
            continue
        key = cleaned.casefold()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(cleaned)
    return deduped
