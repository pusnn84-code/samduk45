# Action button consistency review

User report: the Doran write link is black, sized differently from the adjacent refresh button, and alignment varies throughout the app.

## Findings and changes

- Doran had its own `.doran .primary-button` and comment-submit black overrides, while links additionally inherited padding and line-height from `page-spacing.css`. The adjacent secondary button used different padding and a 44px minimum. Removed those local theme overrides.
- Added `components/app/action-controls.css`, imported once by the root layout. Rules are scoped to member/admin content, with enough specificity to survive feature CSS arriving during navigation. Public/login pages, menu tiles, reactions, calendar date cells, keypad keys and font-size controls retain their separate roles.
- Primary actions use `#00749b`, derived from the logo's blue with darker text contrast. Secondary actions use white, a neutral border and muted blue text. Destructive actions keep red text/border, including hover. Removed the orange offset hover shadow from standard app actions.
- Standard action links and buttons use the same border-box calculation: 48px minimum height, 12px vertical padding, 22px line-height, 1px border, 10px radius, 15px text and 8px group spacing. Long labels may wrap and grow rather than clip.
- Doran's refresh/write actions now align right together on narrow screens; the toolbar has a 16px gap before the feed. Comment submit aligns with the textarea bottom.
- Bible reading complete/read/share actions, prayer form actions, visit actions, pastoral submit/list actions and Scripture copy/clear actions use the common dimensions. Standard form inputs/selects use a matching 48px minimum.
- Preserved completed-reading state and the approved pale-green selected-name state. The latter was previously susceptible to a broader pastoral pressed-button rule.

## Screens reviewed at source level

| Area | Review |
| --- | --- |
| Doran | Feed write/refresh toolbar, comment composer, editor actions |
| Notices | Shared primary confirmation/registration actions |
| Bible reading | Complete/read/share actions; calendar and empathy controls excluded |
| Prayer requests | Submit/edit/secondary action groups; visibility controls preserved |
| Visits/ministry | Register/action groups; month arrows/date cells/status dots excluded |
| Pastoral reports | Submit, list/edit toolbars, name selection highlighting |
| Scripture/hymns | Copy/clear; font-size, verse and score controls remain separate |
| Autumn light | Shared form-submit action; compact prayer reaction and sam choices preserved |
| Directory/birthdays | No bulk resizing of contact-copy links, member cards or navigation |
| Profile/admin | Shared primary/secondary actions and ordinary form fields |

## Validation and release

CSS parsed with PostCSS, source diff checked, and primary colour contrast calculated. `outputs/button-consistency-review/버튼_높이와정렬_점검안.png` is a design illustration, not a screenshot of the running application. Actual mobile/browser layout QA remains pending; do not claim it was performed. User review of the colour proposal precedes production deployment, following the standing preview preference. Existing Vercel upload quota still blocks the pending production update.
