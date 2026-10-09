from odoo.tests import HttpCase, tagged


@tagged("post_install", "-at_install")
class TestSearchLabelsUI(HttpCase):
    def test_search_labels(self):
        self.browser_js(
            "/web/tests?headless&loglevel=2&preset=desktop&timeout=15000"
            "&tag=oy_search_field_labels",
            code="",
            ready="",
            login="admin",
            timeout=240,
            success_signal="[HOOT] Test suite succeeded",
            error_checker=lambda message: "[HOOT]" not in message,
        )
