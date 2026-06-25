# crontab

[crontab](https://en.wikipedia.org/wiki/Cron) (cron table) is a configuration file that specifies shell commands to run periodically on a scheduled time. The system's cron daemon runs in the background and constantly checks the crontab files to execute jobs.

---

## 1. crontab Commands

Use the `crontab` utility to manage your cron jobs.

```bash
# Edit the current user's crontab file (opens in default editor)
crontab -e

# List the active cron jobs for the current user
crontab -l

# Remove all cron jobs for the current user (Warning: destructive!)
crontab -r

# Edit the crontab of a specific user (requires sudo/root permissions)
sudo crontab -u username -e

# Prompt before removing the current user's crontab
crontab -i -r
```

---

## 2. Cron Expression Syntax

A cron expression is a string representing a schedule. It consists of 5 fields followed by the command to execute.

```text
.---------------- minute (0 - 59)
|  .------------- hour (0 - 23)
|  |  .---------- day of month (1 - 31)
|  |  |  .------- month (1 - 12) or JAN, FEB, MAR, APR, MAY, JUN, JUL, AUG, SEP, OCT, NOV, DEC
|  |  |  |  .---- day of week (0 - 6) or SUN, MON, TUE, WED, THU, FRI, SAT (0 or 7 is Sunday)
|  |  |  |  |
*  *  *  *  *  command_to_execute
```

### Special Operators

| Operator | Description | Example | Explanation |
| :--- | :--- | :--- | :--- |
| `*` | **Wildcard** (any value) | `* * * * *` | Run every minute of every day |
| `,` | **Value List** separator | `0 9,17 * * *` | Run at 9:00 AM and 5:00 PM |
| `-` | **Range** of values | `0 9-17 * * *` | Run hourly between 9:00 AM and 5:00 PM |
| `/` | **Step** values (intervals) | `*/15 * * * *` | Run every 15 minutes |

---

## 3. Special Schedule Shortcuts

You can use these predefined text shortcuts instead of the 5-field expressions:

| Shortcut | Equivalent | Description |
| :--- | :--- | :--- |
| `@reboot` | (N/A) | Run once at system startup / boot |
| `@yearly` | `0 0 1 1 *` | Run once a year (Jan 1st, 00:00) |
| `@annually` | `0 0 1 1 *` | Same as `@yearly` |
| `@monthly` | `0 0 1 * *` | Run once a month (1st of the month, 00:00) |
| `@weekly` | `0 0 * * 0` | Run once a week (Sunday, 00:00) |
| `@daily` | `0 0 * * *` | Run once a day (00:00) |
| `@midnight` | `0 0 * * *` | Same as `@daily` |
| `@hourly` | `0 * * * *` | Run once an hour (at minute 0) |

---

## 4. Scheduling Examples

Here are common schedules used in production:

### Time-of-Day Schedules

```text
# Run every day at 3:30 AM
30 3 * * * /path/to/script.sh

# Run twice a day (at noon 12:00 PM and midnight 12:00 AM)
0 0,12 * * * /path/to/script.sh

# Run at 10:15 PM every day
15 22 * * * /path/to/script.sh
```

### Interval-Based Schedules

```text
# Run every minute
* * * * * /path/to/script.sh

# Run every 5 minutes
*/5 * * * * /path/to/script.sh

# Run every hour, on the hour (e.g. 1:00, 2:00, etc.)
0 * * * * /path/to/script.sh

# Run every 4 hours, on the hour
0 */4 * * * /path/to/script.sh
```

### Date & Day-of-Week Schedules

```text
# Run every Monday at 9:00 AM
0 9 * * 1 /path/to/script.sh

# Run every weekday (Monday - Friday) at 6:00 PM
0 18 * * 1-5 /path/to/script.sh

# Run on the 1st and 15th of every month at midnight
0 0 1,15 * * /path/to/script.sh

# Run once a year in December on the 25th at 8:00 AM
0 8 25 12 * /path/to/script.sh
```

---

## 5. crontab Environment Variables

You can define environment variables at the top of your crontab file to customize how tasks execute.

```bash
# Use bash shell instead of the default sh
SHELL=/bin/bash

# Custom search path for commands (avoids needing full absolute paths in script calls)
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Send email notifications for cron outputs to this address (leave empty to disable)
MAILTO=admin@example.com

# Run every day at 12:00 PM using the above environment
0 12 * * * my_custom_command
```

---

## 6. Output & Log Redirection

By default, cron sends an email if a command generates output (standard output or standard error). You can redirect output to files or discard it entirely.

### Discarding Output

```bash
# Discard standard output (stdout) only
0 0 * * * /path/to/script.sh > /dev/null

# Discard both standard output (stdout) and standard error (stderr)
0 0 * * * /path/to/script.sh > /dev/null 2>&1

# Alternative syntax for discarding both stdout and stderr (bash specific)
0 0 * * * /path/to/script.sh &> /dev/null
```

### Logging Output to Files

```bash
# Overwrite log file on each execution
0 0 * * * /path/to/script.sh > /var/log/myjob.log

# Append log output on each execution
0 0 * * * /path/to/script.sh >> /var/log/myjob.log

# Separate standard output and standard error logs
0 0 * * * /path/to/script.sh > /var/log/myjob.log 2> /var/log/myjob.err
```

### Chaining Multiple Commands

```bash
# Run second command only if first succeeds
0 0 * * * /path/to/command1.sh && /path/to/command2.sh

# Run second command regardless of the first command's exit status
0 0 * * * /path/to/command1.sh ; /path/to/command2.sh
```
