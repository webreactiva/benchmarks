# Why Flaky Tests Are Sometimes Worse Than No Tests at All

**Date:** November 20, 2026
**Category:** Best practices / Software quality

There's a phrase that circulates in development teams: "any test coverage is better than none." For a long time, I believed it too. But after watching broken test suites tooth by tooth across several projects, I reached an uncomfortable conclusion: **a test that fails intermittently can do more harm than having no tests at all**.

I'm not talking about tests that fail because the code is broken (that's their job). I'm talking about tests that sometimes pass and sometimes fail even though nobody touched anything, or that fail for reasons completely unrelated to what they supposedly verify. That kind of test is toxic, and here's why.

---

## 1. They train the team to ignore them

When a test fails for no apparent reason, the natural reaction is: "I'll fix it later." And later never comes. After a few weeks, the team develops what's known as *alarm fatigue*: if the suite is red half the time, nobody pays attention when it really matters.

> A falsely failing test is like a fire alarm that goes off every few days. In the end, people unplug it.

When the day comes that the test fails *for real* — because someone broke the business logic — nobody reacts in time. The damage is already in production.

## 2. They make people waste time chasing ghosts

A flaky test forces whoever sees it fail to stop and check: "did I break something?" The answer, most of the time, is no. That time multiplies by every developer, every day, every integration. In a team of ten, a handful of unstable tests can devour hours every week in investigations that lead nowhere.

And worse: sometimes people "fix" the test by adding `sleep`s, random retries, or looser assertions. Bread today, debt tomorrow.

## 3. They erode trust in the whole suite

Tests have one core value: trust. When a developer can run the suite and trust that green means "this works," tests become a real safety net. But every false failure wears that trust down.

Over time, the suite stops being a verification tool and becomes background noise. And a test that doesn't earn trust isn't worth keeping: it consumes execution time, maintenance effort, and cognitive load without returning value.

## 4. They can hide real bugs

This is the strongest argument. Imagine a test that has been failing intermittently for months. Every time it fails, someone marks it as "we know it fails sometimes" and moves on. The day that same test fails because you introduced a serious bug in the pricing calculation, the failure gets camouflaged among the false positives. **Flaky tests create a noise floor under which real bugs hide.**

## 5. They generate silent technical debt

An unstable test is usually a symptom of a deeper problem: unmocked external dependencies, race conditions, shared test data, real clocks instead of injected time, occupied ports... Ignoring the test means ignoring the root cause. And root causes don't go away on their own: they get worse.

## When DOES a failing test deserve to exist?

To be fair: a test that fails **deterministically** and reveals a real bug is pure gold. That test needs to be fixed (the code or the test), not ignored. The key difference is **determinism**:

- Deterministic failing test → there's probably a real bug → act NOW.
- Test that only fails sometimes → it's almost always a problem with the test → fix it or delete it.

## What to do about flaky tests

1. **Don't ignore them.** If a test is flaky, treat it like a first-class bug.
2. **Isolate the cause.** Most common culprits: network dependencies, time, execution order, shared state, or race conditions. Use mocks, dependency injection, clean fixtures, and deterministic data.
3. **Run the test many times** (`--count=20` in some frameworks) to reproduce the flakiness before declaring it fixed.
4. **If you can't stabilize it, delete it or quarantine it** with a traceable issue. A test that doesn't run doesn't waste trust; at least it's honest.
5. **Make a failing suite block the merge.** If you allow merging with red tests, you're training the team to ignore them. Use required status checks in CI.

## Conclusion

Having no tests is a visible problem: everyone knows coverage is missing and can prioritize it. Having tests that fail for no reason is an **invisible and corrosive** problem: it looks like you have quality, but you're actually building on sand.

My rule is simple: **the test suite must be green, always, or it isn't a test suite — it's noise**. A flaky test doesn't protect your code; it makes you believe you're protected when you're not. And that illusion, sooner or later, comes at a price.

---

*Has this ever happened to you? Tell me in the comments what strategy your team uses to deal with flaky tests.*
