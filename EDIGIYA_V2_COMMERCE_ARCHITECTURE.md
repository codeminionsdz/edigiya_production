EDIGIYA_V2_COMMERCE_ARCHITECTURE.md


EDIGIYA V2 — Commerce & Fulfillment Architecture
Version: 2.0
Status: Architecture baseline — implementation follows this document

1. Core Principle
Edigiya must feel extremely simple to the customer while remaining strict and reliable internally.

Discover → Buy → Pay → Verify → Deliver → Notify

Non-negotiable principles
Account creation is optional.

Email is a delivery/notification channel for both guests and account customers.

Account customers get the product in their Edigiya account/library as well.

Payment and fulfillment are separate lifecycles.

Payment verification never automatically means product delivery.

Inventory is authoritative and server-controlled.

Admin actions are auditable.

Digital credentials are secrets, not ordinary public files.

Database state is the source of truth.

Customer UI stays simple; internal states stay precise.

2. Customer Journey
HOME
  ↓
PRODUCT
  ↓
ADD TO CART
  ↓
CART
  ↓
CHECKOUT
  ↓
CUSTOMER INFORMATION
  ↓
PAYMENT METHOD
  ↓
PAYMENT
  ↓
ORDER CREATED
  ↓
PAYMENT VERIFICATION
  ↓
PAYMENT PAID
  ↓
FULFILLMENT
  ↓
DELIVERED
  ↓
EMAIL NOTIFICATION
  ↓
ACCOUNT ACCESS (if account exists)
OR
SECURE EMAIL DELIVERY (guest)
The customer must never be forced to understand the internal machinery.

3. Customer Identity
Guest
A customer can purchase with:

Name

Email

Phone

No account is required.

After successful delivery, the customer receives an email containing secure access to the purchased product.

Account Customer
A logged-in customer purchases normally.

After delivery:

The product appears in the customer's Edigiya purchases/library.

The customer receives an email notification.

The email can lead back to the Edigiya purchase.

Golden rule
Guest
  → Email delivery

Account customer
  → Account access + Email notification
Account creation is never a checkout requirement.

4. Order Lifecycle
CREATED
  ↓
PAYMENT_PENDING
  ↓
PAYMENT_VERIFICATION_REQUIRED
  ↓
PAID
  ↓
FULFILLMENT_PENDING
  ↓
DELIVERED
Alternative outcomes:

PAYMENT_PENDING → FAILED
PAYMENT_PENDING → CANCELLED

PAYMENT_VERIFICATION_REQUIRED → REJECTED
Order, payment, and fulfillment must remain logically separate.

5. Payment Lifecycle
PENDING
   ↓
VERIFICATION_REQUIRED
   ↓
PAID
Alternative outcomes:

PENDING → FAILED
PENDING → CANCELLED

VERIFICATION_REQUIRED → REJECTED
SlickPay
A browser redirect alone is never enough. Payment becomes PAID only after authoritative server-side confirmation.

Flexy / CCP / Bank
Customer submits proof. The payment remains VERIFICATION_REQUIRED until an authorized admin verifies it.

6. Fulfillment Lifecycle
Fulfillment begins only after payment becomes PAID.

NOT_STARTED
    ↓
PENDING
    ↓
DELIVERED
Critical distinction:

Payment = PAID
        ≠
Fulfillment = DELIVERED
7. Delivery Destination
After payment is verified and the product is delivered:

                 PAID
                   ↓
              FULFILLMENT
                   ↓
        ┌──────────┴──────────┐
        │                     │
   HAS ACCOUNT             GUEST
        │                     │
        ↓                     ↓
ACCOUNT LIBRARY          SECURE EMAIL
        │                     │
        └──────────┬──────────┘
                   ↓
              EMAIL SENT
Email is sent in both cases.

For accounts, the account/library is the persistent access location.

For guests, email is the primary access channel.

8. Product Fulfillment Types
Every product must declare its fulfillment type.

File
Examples:

PDF

ZIP

Software

Template

Digital asset

Delivery: secure download.

Link
Examples:

Private course

External service access

Private resource

Delivery: secure access link.

Code
Examples:

License key

Activation code

Gift code

Delivery: secure code display and email.

Credentials
Examples:

Netflix account

Software account

Service account

May contain:

Username
Password
Instructions
Credentials are secrets and must never be exposed through public product data, public storage URLs, logs, or unauthorized APIs.

Manual
For exceptional custom fulfillment supplied by an admin.

9. Inventory Architecture
Inventory is a first-class part of the product model.

When creating/editing a product, admin chooses:

Inventory
○ Unlimited
○ Finite
For finite inventory:

Available quantity: 25
The storefront must reflect authoritative database state.

10. Stock Rules
The frontend never decides stock.

All stock changes are server-side.

Example:

Admin creates product
Stock = 10

Customer buys 1
Stock = 9

Customer buys 2
Stock = 7
The system must never permanently decrement stock simply because an item was added to a cart.

For the initial architecture, permanent consumption occurs at the authoritative successful purchase/payment point.

If temporary reservations are introduced later, they must have expiration and release rules.

11. Atomic Inventory Safety
If only one unit remains:

Stock = 1
Two customers cannot both purchase the final unit.

The server must atomically perform the equivalent of:

decrement only if stock >= requested_quantity
If the condition fails:

OUT_OF_STOCK
No overselling.

12. Variants and Inventory
When variants have different inventory, stock belongs to the sellable variant.

Example:

Netflix Premium

1 Month   → Stock 12
3 Months  → Stock 5
12 Months → Stock 2
Buying 3 Months × 1 changes:

3 Months: 5 → 4
not generic product stock.

13. Unique Digital Inventory
Some digital products have individually consumable units.

Example:

Netflix Premium
Available credentials: 8
The system may maintain:

Credential #001 → available
Credential #002 → available
Credential #003 → available
...
On delivery:

available
   ↓
assigned to order
   ↓
delivered
This prevents the same unique credential/code from being sold twice.

Generic files that can be reused may use unlimited inventory.

14. Product Creation UX
Recommended admin structure:

PRODUCT INFORMATION
────────────────────
Name
Description
Category
Price
Images

FULFILLMENT
────────────────────
Delivery type
○ File
○ Link
○ Code
○ Credentials
○ Manual

INVENTORY
────────────────────
○ Unlimited
○ Finite

Quantity
[ 10 ]

VARIANTS
────────────────────
Enable variants
[ Yes / No ]
The form should reveal only the fields relevant to the chosen fulfillment type.

15. Netflix Example
Admin creates:

Product:
Netflix Premium

Price:
1500 DA

Delivery:
Credentials

Inventory:
Finite

Quantity:
10
Internally:

Product
 ├─ fulfillment_type: credentials
 ├─ inventory_type: finite
 └─ available_units: 10
If individual credentials are managed, admin can add units:

Credential 01
Email: ...
Password: ...

Credential 02
Email: ...
Password: ...

Credential 03
Email: ...
Password: ...
The storefront only needs to show availability such as:

In stock
It must never expose credentials.

16. Order → Inventory → Fulfillment
The target flow is:

CUSTOMER CHECKOUT
       ↓
AUTHORITATIVE PRICE / VARIANT / STOCK CHECK
       ↓
ORDER CREATED
       ↓
PAYMENT
       ↓
PAYMENT VERIFIED
       ↓
PAID
       ↓
INVENTORY CONSUMPTION / UNIT ASSIGNMENT
       ↓
FULFILLMENT
       ↓
DELIVERY
       ↓
EMAIL
For unique credentials/codes, assignment must be atomic so two orders cannot receive the same unit.

17. Email Architecture
Email is a first-class delivery/notification channel.

Guest
Order paid
   ↓
Fulfillment delivered
   ↓
Email customer
   ↓
Secure product access
Account
Order paid
   ↓
Fulfillment delivered
   ↓
Attach to account library
   ↓
Email customer
   ↓
Customer opens product in Edigiya
The email system must never expose fulfillment content before authorization.

18. Initial Email Events
Order Received
Sent after order creation.

Payment Verification Required
For manual payment methods.

Payment Confirmed
When payment becomes PAID.

Product Delivered
For guests: secure product access.

For account customers: notification that the product is available in their Edigiya account.

Payment Rejected
When manual proof is rejected.

19. Secure Delivery
Prefer:

Email
  ↓
Secure Edigiya delivery page
  ↓
Authorization check
  ↓
Display/download fulfillment
For account customers:

Email
  ↓
Edigiya account
  ↓
Authorization
  ↓
Purchase
For guests, use a strong non-guessable secure access mechanism.

20. Admin Order Operations
Example:

ORDER #EDG-1024

Customer
Ahmed
ahmed@gmail.com

Payment
✓ PAID

Inventory
✓ Assigned

Fulfillment
● PENDING

[ Deliver Order ]
After delivery:

Payment
✓ PAID

Inventory
✓ Consumed

Fulfillment
✓ DELIVERED

Email
✓ Sent
Email failure must not undo successful fulfillment.

The system should record email status and allow safe retry.

21. Failure Handling
Payment rejected
Payment = REJECTED
Fulfillment = NOT DELIVERED
No product access and no credential assignment.

Email failed
Payment = PAID
Fulfillment = DELIVERED
Email = FAILED
Retry email without creating a second fulfillment.

Fulfillment failed
Payment = PAID
Fulfillment = PENDING
Do not mark delivered until fulfillment succeeds.

22. Idempotency
Critical operations must be safe to retry:

Checkout

Payment verification

Payment callbacks

Inventory consumption

Credential assignment

Fulfillment delivery

Email sending

A retry must never:

Create duplicate orders

Decrement stock twice

Assign a credential twice

Deliver one unique credential to two customers

Create duplicate fulfillment

23. Audit Events
Important transitions should create events:

ORDER_CREATED
PAYMENT_CREATED
PAYMENT_PROOF_SUBMITTED
PAYMENT_VERIFIED
PAYMENT_REJECTED
INVENTORY_DECREMENTED
FULFILLMENT_CREATED
FULFILLMENT_ASSIGNED
FULFILLMENT_DELIVERED
EMAIL_QUEUED
EMAIL_SENT
EMAIL_FAILED
This gives Edigiya an operational history.

24. Security Boundaries
Customer can access
Their own orders

Their own delivered products

Their own fulfillment content

Admin can
Verify/reject payments

Manage products

Manage inventory

Manage fulfillment

Deliver orders

Retry email

Review audit events

Public storefront can access
Product information

Price

Availability

Public storefront must never access
Credentials

Private fulfillment files

Payment proofs

Other customers' orders

Internal admin data

25. Customer-Facing Statuses
Internal states remain precise, but customers see simple language.

Internal state	Customer message
Order created	We received your order.
Verification required	We're verifying your payment.
Paid	Payment confirmed.
Fulfillment pending	Your product is being prepared.
Delivered	Your product is ready.
Problem	We need your attention.
Never expose raw database state names to customers.

26. Architecture Layers
UI
 ↓
Server Actions / API
 ↓
Business Rules
 ↓
Database
 ↓
External Providers
The UI must never be authoritative for:

Pricing

Stock

Payment status

Fulfillment authorization

Credential assignment

27. Implementation Plan
Phase 1 — Data Model & Business Rules
Finalize:

Product fulfillment type

Inventory model

Variant inventory

Order lifecycle

Payment lifecycle

Fulfillment lifecycle

Guest/account ownership

Email events

Audit events

Phase 2 — Product & Inventory
Implement:

Finite/unlimited inventory

Variant stock

Real stock display

Atomic stock operations

Admin product creation/editing

Phase 3 — Fulfillment
Implement:

File

Link

Code

Credentials

Manual

Secure fulfillment access

Unique-unit assignment

Phase 4 — Customer Delivery
Implement:

Account library

Guest secure delivery

Email notifications

Secure delivery links

Phase 5 — Payment Providers
Implement:

Flexy

CCP / Bank

SlickPay

Server-side verification

Provider callbacks where officially supported

Phase 6 — Admin Operations
Implement:

Payment verification

Inventory visibility

Fulfillment operations

Delivery

Email retry

Audit timeline

Phase 7 — End-to-End QA
Test:

Guest purchase

Account purchase

Successful payment

Rejected payment

Out of stock

Concurrent final-stock purchase

File delivery

Code delivery

Credential delivery

Email failure

Email retry

Duplicate requests

Variant stock

Unauthorized fulfillment access

28. Golden Rules
Account creation is optional.

Email is sent to every customer after the appropriate events.

Payment is not fulfillment.

Stock is authoritative and server-controlled.

Adding to cart never permanently consumes stock.

Finite inventory is atomic.

Variants may have independent stock.

Unique credentials/codes are individually assignable when required.

Secrets never belong in public product data or public storage.

Retries never duplicate critical operations.

Customer UI stays simple; backend states stay precise.

Admin actions are auditable.

29. Final Target
                    CUSTOMER
                       │
                       ▼
                    PRODUCT
                       │
                       ▼
                     BUY
                       │
                       ▼
                   CHECKOUT
                       │
                       ▼
                    PAYMENT
                       │
                       ▼
                  VERIFICATION
                       │
                       ▼
                      PAID
                       │
                       ▼
                  INVENTORY
                       │
                       ▼
                 FULFILLMENT
                       │
              ┌────────┴────────┐
              ▼                 ▼
           ACCOUNT             GUEST
              │                 │
              ▼                 ▼
       EDIGIYA LIBRARY         EMAIL
              │                 │
              └────────┬────────┘
                       ▼
                  EMAIL SENT
                       │
                       ▼
                    ACCESS
Simple for the customer.
Controlled for Edigiya.
Safe for digital products.
Ready for real payment and fulfillment.

Implementation Gate
This document is the baseline for Edigiya V2.

Implementation should proceed phase-by-phase. Existing functionality must not be removed or broken unless the new architecture explicitly replaces it.

Before changing production code, each phase should be reviewed against this document.