# Availability measurement: operator procedure

The probe measures the unauthenticated `GET /login` HTTP response on the loopback deployment. That endpoint is public and should return HTTP 200; the customer root page redirects unauthenticated users to sign-in. This measures the HTTP entry point, not every workflow or database operation. The observer and server share a machine, so a powered-off machine creates missing observations, not recorded failed requests. Never reset a database containing data to keep.

## Preparation

Use a dedicated local machine in Asia/Hong_Kong time, keep it powered and awake, install Node 24 and dependencies, and initialise a disposable demo database following the README. Build the application, start `npm run start -- --hostname 127.0.0.1 --port 3100` from `logistics/`, and verify `curl -i http://127.0.0.1:3100/login` returns 200. The probe uses `SOAK_URL` (default that URL), `SOAK_TZ` (default Asia/Hong_Kong), `SOAK_DIR` (default `evidence/availability` relative to the working directory), and `SOAK_TIMEOUT_MS` (default 10000). Each invocation writes exactly one timestamped JSONL record, including failures. The probe skips invocations outside the window.

## Scheduler

**Linux cron.** Use absolute paths and replace the example paths; set the machine timezone to Asia/Hong_Kong. Run `crontab -e` as the same account that owns the evidence directory:

```cron
CRON_TZ=Asia/Hong_Kong
*/5 8-23 * * * cd /absolute/path/comp3500-logistics/logistics && /absolute/path/to/node scripts/soak-probe.mjs >> /absolute/path/comp3500-soak-cron.log 2>&1
```

**Windows Task Scheduler.** Save the following as `C:\comp3500\run-soak.cmd`, replace the paths, and ensure the machine is configured for Hong Kong local time. Create the five-minute task in an elevated Command Prompt; Task Scheduler runs only while Windows is running and the account has access to the files.

```bat
@echo off
cd /d C:\path\to\comp3500-logistics\logistics
"C:\Program Files\nodejs\node.exe" scripts\soak-probe.mjs >> C:\comp3500\soak.log 2>&1
```

```bat
schtasks /Create /TN "COMP3500 Soak Probe" /SC MINUTE /MO 5 /ST 08:00 /ET 23:59 /TR "C:\comp3500\run-soak.cmd"
```

Inspect the task's history, test one invocation, and verify that the date-named JSONL file grows. Keep the computer awake; scheduled invocations do not measure time when it is asleep or switched off.

## Server keeper

On Linux with PM2 installed and a production build already made, from the application directory:

```sh
pm2 start npm --name comp3500-server -- start -- --hostname 127.0.0.1 --port 3100
pm2 save
pm2 startup
# Run the platform-specific command printed by pm2 startup, then verify after a restart.
```

On Windows, the following PowerShell example registers a separate startup task with restart-on-failure; replace the paths and use an account with access to the application and database:

```powershell
$root = 'C:\path\to\comp3500-logistics\logistics'
$action = New-ScheduledTaskAction -Execute 'C:\Program Files\nodejs\node.exe' -Argument 'node_modules\next\dist\bin\next start --hostname 127.0.0.1 --port 3100' -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 100 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'COMP3500 Server Keeper' -Action $action -Trigger $trigger -Settings $settings
Start-ScheduledTask -TaskName 'COMP3500 Server Keeper'
```

Test recovery by stopping the server process, and verify the task account and startup privileges. Do not make the probe depend on the keeper: failed pings and missing scheduled observations must remain visible. Record each outage, suspected cause, intervention and recovery in a dated incident note; avoid recording credentials or personal data.

## Summarise and interpret

After complete days have elapsed, from the application directory:

```sh
node scripts/soak-summary.mjs 2026-11-12 2026-11-30
cat evidence/availability/summary.json
```

Choose dates matching the actual observation period. There are 192 five-minute slots in each full daily window. A slot with multiple observations succeeds only if all succeeded. The summary reports observed uptime (successful / observed), coverage, a conservative window percentage (successful / expected; missing slots count against it), and contiguous failed-or-missing incident starts. Missing days are retained with zero observed slots and a null observed-uptime percentage. A gap across day boundaries remains one contiguous incident. The counts are sampling estimates, not exact outage durations. Reconcile each incident with an operator note; keep raw JSONL and do not backfill missed samples.
