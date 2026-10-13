# Finance MVP: accounting conventions

The executable checks are `focus/tests/model.test.ts`, `focus/tests/calculations.test.ts` and `focus/tests/investments.test.ts`; run `cd focus && pnpm test` with Node 24.

## Stored values and compatibility

Money uses integer hundredths, at most 1,000,000,000,000 per entered payment or balance. Derived surplus and net worth may be negative. Supported currencies use this two-decimal convention: EUR, USD, GBP, CHF, CAD, AUD, SEK, NOK, DKK and PLN. Each vault has one currency, with no conversion.

Inputs accept `1234.50` or `1234,50`, without thousands separators, exponent notation or fractional hundredths. Asset summaries display whole units; monthly breakdowns retain cents; inputs and history preserve exact hundredths. ISO calendar dates use `YYYY-MM-DD`, between 1900 and 2199. Unknown balances remain `null`, not zero. Lists allow 120 entries, snapshots 240, and plaintext is limited to 256 KiB. Validation rejects unknown fields, duplicate IDs, invalid dates/rates/allocations and nonfinite or unsafe values.

Financial schema v3 retains legacy fields for compatibility. Valid v1/v2 data upgrades only after browser decryption and validation; unsupported schemas never become empty vaults. Retired FIRE settings, scenarios, age/horizon, reserve-month targets, allocation rules, policy notes and income-growth fields remain encrypted and validated, but have no effect on the current Overview. New vaults have no accounts, income or allocation rules. New snapshots set the retained historical-income slot to `null`. Old observations are preserved, and no destructive migration is required.

## Monthly estimate

```text
annual income = salary per payment × payments per year + sum(extra income)
raw annual costs = 12 × monthly costs + annual costs + irregular annual costs
included adjustment = current included loan payments − entered included loan commitments
annual costs = raw annual costs + 12 × included adjustment
monthly income = round(annual income / 12)
monthly costs = round(annual costs / 12)
additional loan payments = required payments not already included in spending
monthly surplus = monthly income − monthly costs − additional loan payments
monthly shortfall = max(0, −monthly surplus)
```

Monthly detail rows use differences between rounded cumulative annual amounts divided by 12, so fractional-cent rounding reconciles with the total. Included loans show only a final-payment adjustment when their actual payment differs from the commitment already in spending.

Annualized amounts smooth payment timing; they do not establish today's bank balance. Loan payments marked already included in essential recurring spending are counted once. Validation requires enough such spending to cover the entered commitments; irregular yearly costs cannot stand in for these monthly payments. The application cannot determine inclusion from an expense label. Retired scenario costs and investment choices are ignored, rather than silently influencing this estimate.

## Current loan commitments

```text
nominal convention: monthly rate = annual percentage / 1200
effective convention: monthly rate = (1 + annual percentage / 100)^(1/12) − 1
monthly interest = round(recorded loan balance × monthly rate)
required payment = min(entered monthly payment, recorded balance + monthly interest)
```

A final partial payment is capped; a zero balance has no required payment. If a positive loan's payment does not exceed rounded interest, the UI flags that it does not reduce the balance at the entered rate. A variable rate is recorded as such; no future schedule or payoff date is calculated. Required amounts are estimates using the latest entered balance/rate, not lender-verified bills. No repayment is written into an observed balance automatically.

## Balances, savings and history

```text
cash set aside = sum(amounts reserved inside cash accounts)
available cash = recorded cash − cash set aside
tracked net worth = recorded cash + recorded portfolios − recorded loans
```

Reserved money is part of an existing cash balance and cannot exceed it. Existing links to planned costs are preserved solely to retain their saved labels and validation; no scenario spending or allocation runs. New portions can be named freely as other goals or marked as emergency savings. Legacy portfolio shares/bonds percentages remain validated and preserved but have no editor or effect on calculations. Contribution totals describe money paid in and are already part of the balance. Neither contribution totals nor reserved portions are added again to net worth. There is no APY accrual or automatic price feed.

Unknown balances are excluded from sums with an incomplete-total notice. Check-ins record only observed values and their dates. Missing periods remain missing; projected values are never observations. It does not infer growth or repayments since an older observation.

The account donut/table uses `recorded account balance / (known cash + known investments) × 100`. Loans and reserved portions are not additional slices. Unknown balances and zero-total shares display a dash. The cash bar separately divides emergency savings, each non-empty named savings goal and available cash by recorded cash. Small segments keep their percentages in the accompanying rows when labels would not fit inside the chart. The investment table’s Share column uses each known investment balance divided by all known investment balances; it excludes cash. Contributions appear only in the investment table. Cash does not have a contribution column.

Check-ins are on demand. The retired review cadence remains stored for compatibility; it has no notices or calculation effect. Balance history retains the dates the user recorded.

## Educational basis

The low-maintenance approach and separation of available cash from investments follow the [Bogleheads España guide](https://bogleheads.es/guia). It remains an educational reference; the MVP does not choose funds, allocations, a savings rate or a retirement date for the user.

## Investment gains and recorded growth

Schema v3 adds cumulative `totalWithdrawals` (including cash distributions) and `cashFlowsConfirmed` to portfolios and portfolio observations. Migration validates v1/v2 in their original shape before upgrading; existing contributions remain, withdrawals become unknown, and confirmation is false. The confirmation flag is now legacy metadata and is ignored by gain calculations. Existing non-null withdrawals remain intact. A missing withdrawal total defaults to zero in calculations and editors; a finished check-in records that zero. Historical payloads are not rewritten.

Known cumulative contributions minus withdrawals remain available even when the valuation is missing. A missing valuation still leaves gain and gain percentage unknown; it never becomes a zero balance.

For a check-in on or after the current observation date, money added and taken out are changes since that observation, both starting at zero. Finish adds each change to the original saved cumulative total exactly once, regardless of Back/Next navigation. If initial contributions are unknown, or the entry predates the saved balance, the drawer instead asks for absolute totals as of the selected date; it never adds a later baseline to an earlier observation. All totals pass the existing integer-money and document validation before the snapshot is saved.

```text
net money added = total contributed − total taken out
cumulative gain = recorded balance − net money added
simple gain percentage = cumulative gain / total contributed × 100
```

A known balance and contribution total are required for gains. Missing contributions or balances remain unknown; only missing withdrawals default to zero, as requested. When contributions are zero, the percentage stays undefined. Withdrawals can exceed contributions (for example after selling at a profit). Increasing contributions and balance equally does not change the gain. The total gain includes payouts entered as withdrawals. These are nominal recorded amounts; there is no separate tax, inflation or fee adjustment. This percentage does not account for the timing of deposits and is not an annualized return, IRR, time-weighted return or a compound growth index.

Recorded snapshots retain their dates and amounts in Balance history. The historical investment chart has been removed; no historical curve is inferred from current balances.


## Future simulation

Future uses the latest recorded balances as today's starting assets. Each investment's current lifetime gain/loss percentage, rounded to two decimals like the accounts table, seeds its editable annual return assumption at the user's request. This is not an annualization or a measured annual return; the Assumptions disclosure explains the distinction. Cash and unknown gains default to 0%. Saved balances, contributions and historical observations are not changed. The inputs follow the standard starting amount, contributions, horizon and estimated return approach illustrated by the [Investor.gov compound interest calculator](https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator).

```text
monthly factor = (1 + annual return / 100) ^ (1 / 12)
next account balance = previous balance × monthly factor + monthly contribution
retained cash = (monthly surplus − allocated contributions) × elapsed months
projected assets = sum(account balances) + retained cash
growth = projected assets − starting assets − total monthly surplus added
```

Contributions arrive at month end. Preview transfers redistribute starting balances without adding assets and cannot use cash set aside. Monthly allocation cannot exceed the existing calculated surplus; unallocated surplus stays as cash earning 0%. The comparison keeps the original account balances under the same rate assumptions, with all monthly surplus retained as cash at 0%. Rounding occurs at displayed cent totals, rather than rounding away monthly compounding.

A missing balance blocks projection, rather than being treated as zero. Negative monthly surplus, invalid amounts/rates, overdrafts and unsafe numeric totals produce an explicit error. Horizons are 1–50 years and annual assumptions −100% to 100%. Inputs are local preview state, never written to the vault; Reset recreates them from current gain percentages; leaving Overview clears them. Income and costs are held constant. Taxes, fees, inflation, transfer costs and loan balances are not projected; the chart shows assets rather than future net worth.
