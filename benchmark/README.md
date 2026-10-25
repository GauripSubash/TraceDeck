# Investigation benchmark protocol

Status: prepared, no trials recorded and no measured improvement yet.

## Question and scope

Does the investigation drawer reduce the time needed to identify the earliest
WARN or ERROR event in one of the six synthetic failure traces?

Compare two modes in the existing frontend:

- `baseline`: use the event table, pagination, refresh, and source/time filters.
  Do not open Investigate or use API calls, source files, browser search, or DevTools.
- `tracedeck`: use the same controls plus Investigate and the timeline drawer.

The table exposes all fields needed to answer. No separate baseline app is needed.
This measures a specific lookup task on synthetic data. The earliest warning is
an observable event, not proof of the failure's root cause.

## Prepare before recruiting participants

1. Record the tested commit (`git rev-parse HEAD`), browser/version, machine,
   total database event count, and any deviations in session notes. Keep the same
   app, machine, browser, viewport, and data for all trials.
2. Check for existing servers before starting anything. Use the normal local
   frontend and backend. Do not reset the database or delete events.
3. Use the frontend to check whether the demo dataset is already imported.
   For each task's exact five-second window, with All services, verify that each
   of its five expected request events occurs once. Record extra unrelated events.
   If the fixture is absent, import it once using the upload interface. If only
   part is present or duplicate request events exist, pause and resolve the setup
   before timing. Reimporting adds records and can contaminate the timeline.
4. Record the actual total; existing unrelated events can make it greater than
   100. Keep them unchanged. Describe this as a 100-event fixture within the
   recorded database size, rather than claiming exactly 100 total records.
5. Have an observer/timekeeper hold `answers.md` and the results file. Participants
   see only one task card at a time from `tasks.md`, never the answer key or fixture.

## Practice and assignment

Aim for four participants unfamiliar with the answers. Three is a small pilot;
the author can practice but should not be included as an independent participant.
Use anonymous IDs P01, P02, etc. Explain both modes and give each person an untimed
practice in each mode using successful request req-demo-1020. Its answer is
"no WARN or ERROR". Let them practice filters, pagination, and closing the drawer.

Assign schedules in recruitment order and repeat the four schedules if needed.
`B` means baseline, `T` means tracedeck. Each participant performs six trials,
three per mode, with each task used once:

- S1: T1-B, T2-T, T3-B, T4-T, T5-B, T6-T.
- S2: T1-T, T2-B, T3-T, T4-B, T5-T, T6-B.
- S3: T4-B, T5-T, T6-B, T1-T, T2-B, T3-T.
- S4: T4-T, T5-B, T6-T, T1-B, T2-T, T3-B.

These schedules vary the starting mode and task order. Across a complete group
of four, every task appears equally often in both modes. Task difficulty and
learning effects remain limitations of this small convenience sample.

## Run each trial

1. Outside the timer, close the drawer, Clear filters, and wait for page 1 to load.
   Use this identical starting state in both modes. Do not preload a task's trace.
2. Tell the participant the allowed mode. Reveal the task and start a stopwatch
   together. Reading the task and navigating the UI are included in elapsed time.
3. Ask them to state an event type and service. Stop at their first final answer,
   or at 180 seconds if there is no answer. Do not coach or give correctness
   feedback until all six trials finish. A wrong final answer ends the trial.
4. Record elapsed seconds to one decimal and the actual answer. Score both fields
   against `answers.md`, ignoring surrounding whitespace and letter case.
5. Record outcome `correct`, `incorrect`, `timeout`, or `invalid`. Use `invalid`
   for an interruption, technical failure, or mode violation; explain it in notes.
   For timeout, record 180 seconds. Preserve every attempt; do not rerun a failed
   task to replace it or remove a slow trial.
6. Reset for the next task. Breaks occur outside the timer.

## Results file

`results.csv` contains column names only. Add one row per actual timed trial.
Blank values mean missing data, never zero. Do not enter practice or invented
example measurements. Use ISO dates with timezone for `recorded_at`, such as an
actual local timestamp ending in `-04:00` or `-05:00` as appropriate.

- `participant_id`, `schedule`, `trial_order`: anonymous ID, S1-S4, and 1-6.
- `task_id`, `mode`: T1-T6 and `baseline` or `tracedeck`.
- `elapsed_seconds`: observed duration, including unsuccessful trials.
- `outcome`: one of the four outcomes above.
- `answer_event_type`, `answer_source`: the participant's answer, blank if none.
- `recorded_at`, `commit_sha`: actual trial timestamp and tested commit.
- `notes`: interruptions, mode violations, setup differences, or other context.

## Analysis plan, fixed before collecting data

Report participants, trial counts, and correct/incorrect/timeout/invalid counts
by mode first. Show individual trial times and participant-level summaries.
Keep invalid rows visible but exclude them from completion-rate denominators;
report their counts and reasons separately.

For each participant with at least two correct trials in each mode, calculate
their median correct-answer time in each mode. Then calculate the median of
those participant medians for each mode. Report the number of qualifying
participants and require at least three before describing an improvement result.
For even counts, the median is the average of the two middle sorted values.

    improvement_percent = ((baseline_median - tracedeck_median) / baseline_median) * 100

Use a positive baseline median. Retain a negative result if the drawer is slower.
Correct-only timing can hide an accuracy tradeoff, so also report completion
rates and a sensitivity summary using all valid trials, assigning the predefined
180-second cap to incorrect/timeout outcomes. Do not call a speed difference an
overall benefit if accuracy worsens. Do not change the protocol to obtain 35%.

There are no results to calculate now. A calculation script and results review
can follow after this protocol is understood and real trials exist. Any resume
wording must match the actual measurement, sample size, task, and limitations.
