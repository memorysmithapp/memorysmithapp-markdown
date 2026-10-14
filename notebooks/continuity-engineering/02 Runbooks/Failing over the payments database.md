---
name: Failing over the payments database
aliases: [Payments failover]
tags: [runbook, payments]
type: runbook
maturity: growing
reviewed: false
scope: payments
source: Drill 2026-03
author: Continuity Engineering
created: 2026-02-02
updated: 2026-03-06
rehearsed_at: 2026-03-04
---

The procedure for promoting the standby region when the primary is lost. It is
written to be followed by somebody who has not read it before, at three in the
morning.

> [!caution] Do not start this without declaring the incident first
> A failover that nobody announced is indistinguishable from an outage, and
> the second one is what people escalate.

# Before you start

- [x] The incident is declared and the channel exists
- [x] The primary is confirmed unreachable, not merely slow
- [ ] The last replica lag is recorded, for [[Recovery Point Objective]]
- [ ] Somebody who is not you is watching the clock

# The steps

1. Freeze writes at the edge.
2. Promote the standby. See [[Exercise 2026-03 · Region loss#What went wrong]]
   for the two minutes this took last time.
3. Repoint the application, then verify a real payment end to end.
4. Announce the new primary, in writing, before you rest.

Step 2 is the one that decides whether the ==objective is met==, because
everything before it is detection and everything after it is confirmation.

![[Blast radius]]

# The commands

Read the lag before anything else, as the drill learned;[^drill] it is the
number the review will ask for first.[^14] Above thirty seconds, promoting loses more than the
[[Recovery Point Objective]] allows, and the decision is no longer this
runbook's.[^2]

```sql
SELECT client_addr,
       replay_lag,
       pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS bytes_behind
FROM pg_stat_replication
ORDER BY replay_lag DESC;
```

Freeze writes and promote the standby, from the bastion of the standby region:

```bash
# Step 1: refuse writes at the edge, and confirm the refusal
payments-edge freeze --reason "failover $(date -u +%Y-%m-%dT%H:%MZ)"
payments-edge status | grep -q 'writes: frozen' || exit 1

# Step 2: promote, then wait for the standby to accept writes
pg_ctl promote -D /var/lib/postgresql/16/main
until psql -tAc 'SELECT NOT pg_is_in_recovery()' | grep -q t; do sleep 2; done
```

Step 3 is one line of configuration, and it is the line this change touched
in the March exercise:

```diff
 payments:
   database:
-    host: pg-primary.eu-west-1.internal
+    host: pg-primary.eu-central-1.internal
     pool_size: 40
```

The alert that pages for this runbook, so whoever is on call knows what woke
them:[^drill]

```yaml
alert: PaymentsPrimaryUnreachable
expr: pg_up{cluster="payments", role="primary"} == 0
for: 2m
labels:
  severity: page
  runbook: failing-over-the-payments-database
```

The same condition as the dashboard writes it, in a language the page draws as
typed:

```promql
max by (region) (pg_replication_lag_seconds{cluster="payments"}) > 30
```

And the message to post when it is done, as it is pasted:

```
Payments failover complete. New primary: eu-central-1.
Writes resumed at <time>. Lag at promotion: <seconds>.
```

# Notes for whoever revises this

%% Steps 1 and 2 were one step until the March exercise showed the freeze
needs its own confirmation. Do not merge them again. %%

The dashboard query is written as
[the replication dashboard](https://example.org/dashboards/replication) and the
subject of this page is #failover, which files it nowhere: this page is filed
by its `tags:` and by the folder it is in.

[^drill]: Drill 2026-03, the run this page was rehearsed against: steps 1 and 2
    took eleven minutes together, nine of them waiting on the freeze.
[^14]: The lag is read before promoting because promotion ends replication:
    afterwards nothing reports how far behind the standby was.
[^2]: Thirty seconds is the payments RPO; an incident above it is decided by
    whoever owns the service, not by whoever restores it.
