Odoo Apps listing assets
========================

The addon is distributed under LGPL-3. ``LICENSE`` includes LGPL version 3
and its incorporated GPL version 3 terms. The text is copied verbatim from
the locally installed official Odoo source license (without Odoo's preamble).

Branding
--------

Author: Herianto OY
Support: herianto.oy@gmail.com

The HTML description follows the author's ``oy_account_reset_filter`` visual style:
plum purple (#875A7B), teal (#1AD3BB), dark ink (#2B2D42), rounded cards,
inline styles, and a direct email contact. The icon reuses the author's ``oy_fields_restriction`` branding.
The cover was produced with ImageGen using the OY brand reference. It uses
a light background, plum typography, and restrained teal accents. The icon and
cover are illustrations, not UI screenshots. The HTML deliberately has no hardcoded
Odoo major version, edition test claims, price, external image URLs, JavaScript,
or interactive dependencies. The addon manifest identifies the branch version. User documentation is in
``doc/index.rst``.

Assets
------

* ``static/description/index.html``: English Apps description.
* ``static/description/icon.png``: 256 x 256 transparent-corner module icon.
* ``static/description/banner.png``: 1600 x 800 listing cover.
* ``static/description/configuration.png``: real configuration form screenshot.
* ``static/description/custom_filter.png``: real custom filter screenshot.
* ``static/description/custom_group_by.png``: real custom group screenshot.

The original icon and cover artwork are included as ready-to-use PNG files.

Screenshot capture guide
------------------------

Capture the three referenced screenshots from the actual target Odoo branch.
Use a disposable demonstration database and sample records, never customer data.

``configuration.png``
    Show the complete Search Field Labels form: selected model, Apply To,
    Apply On, Priority, and Field Settings rows. Include technical field names,
    original labels, and distinct Filter/Group By labels. Keep the menu title
    and enough surrounding UI to establish the feature's location.

``custom_filter.png``
    Open the matching model/action/menu and Add Custom Filter. Show the field
    selector with the configured Filter Label visible. Use labels that match
    the configuration screenshot, and make the text legible at listing width.

``custom_group_by.png``
    Add a custom group in the same scope. Show the configured Group By Label
    in the selected group and search tag. Use the same demonstration configuration.

The HTML references these exact filenames. Capturing the real UI is a required
release step; do not create mock UI or publish broken screenshot references.

Before submission
-----------------

* Match the repository branch, manifest version, and intended Odoo major version.
* Include author, support, license, category, description, and cover image metadata.
* Install and run the addon tests on the target Odoo version.
* Capture or verify all three real screenshots for that branch.
* Render the description and inspect desktop and narrow layouts.
* Confirm every local image reference exists and only mailto links appear in HTML.
* Package the addon with its manifest at ``oy_search_field_labels/__manifest__.py``.
* Exclude credentials, database files, logs, caches, temporary tooling, and Git metadata.
* Keep the LGPL-3 license; publishing and store pricing are separate release decisions.

This documentation prepares the package. It does not register a repository,
push a branch, or publish the app to the Odoo Apps Store.

Publishing the prepared branches
================================

After reviewing the release, push the version branches to the repository::

    git push origin 19.0 20.0

Register the repository with the matching branch at
https://apps.odoo.com/apps/upload and review the scanner result before publishing.
The repository contains the addon in the top-level ``oy_search_field_labels``
directory. The release ZIP is also suitable for manual addon deployment;
the Apps submission workflow scans the registered Git repository.
