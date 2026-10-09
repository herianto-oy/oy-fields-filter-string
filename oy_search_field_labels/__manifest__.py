{
    "name": "Search Field Labels",
    "summary": "Configure field labels for custom filters and custom group by",
    "author": "OY",
    "maintainer": "Herianto OY",
    "support": "herianto.oy@gmail.com",
    "version": "18.0.3.0.2",
    "category": "Technical",
    "license": "LGPL-3",
    "images": ["static/description/banner.png"],
    "depends": ["base", "web"],
    "data": [
        "security/ir.model.access.csv",
        "views/search_field_label_views.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "oy_search_field_labels/static/src/**/*.js",
        ],
        "web.assets_unit_tests": [
            "oy_search_field_labels/static/tests/**/*.test.js",
        ],
    },
    "installable": True,
    "application": False,
}
