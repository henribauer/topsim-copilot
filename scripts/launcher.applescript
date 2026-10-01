-- TOPSIM Copilot desktop launcher. All logic is in scripts/start.sh (testable from a terminal);
-- this only calls it and shows an alert if it fails. Built by scripts/make-launcher.sh.
on starten()
	set proj to (POSIX path of (path to home folder)) & "Library/Mobile Documents/com~apple~CloudDocs/Claude/topsim-copilot"
	try
		do shell script "/bin/sh " & quoted form of (proj & "/scripts/start.sh")
	on error msg
		display alert "TOPSIM Copilot" message msg as critical
	end try
end starten

on run
	starten()
end run

on reopen
	starten()
end reopen
