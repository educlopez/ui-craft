// Windows 10+: create the worker atomically inside an owned Job Object.
// No process-tree snapshot and no period in which a running child is unowned.
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class UICraftJob {
    [StructLayout(LayoutKind.Sequential)] struct IO_COUNTERS {
        public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
        public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
    }
    [StructLayout(LayoutKind.Sequential)] struct BASIC_LIMIT {
        public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)] struct EXTENDED_LIMIT {
        public BASIC_LIMIT BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }
    [StructLayout(LayoutKind.Sequential)] struct ACCOUNTING {
        public long TotalUserTime, TotalKernelTime, ThisPeriodTotalUserTime, ThisPeriodTotalKernelTime;
        public uint TotalPageFaultCount, TotalProcesses, ActiveProcesses, TotalTerminatedProcesses;
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct STARTUPINFO {
        public int cb;
        public string lpReserved, lpDesktop, lpTitle;
        public uint dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
        public ushort wShowWindow, cbReserved2;
        public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
    }
    [StructLayout(LayoutKind.Sequential)] struct STARTUPINFOEX {
        public STARTUPINFO StartupInfo;
        public IntPtr lpAttributeList;
    }
    [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION {
        public IntPtr hProcess, hThread;
        public uint dwProcessId, dwThreadId;
    }
    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetInformationJobObject(IntPtr job, int kind, ref EXTENDED_LIMIT info, uint size);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool QueryInformationJobObject(IntPtr job, int kind, out ACCOUNTING info, uint size, IntPtr length);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool TerminateJobObject(IntPtr job, uint code);
    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int kind);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool GetNamedPipeServerProcessId(IntPtr pipe, out uint serverPid);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, int flags, ref IntPtr bytes);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, IntPtr attribute, IntPtr value, IntPtr size, IntPtr previous, IntPtr returned);
    [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool CreateProcessW(string app, StringBuilder command, IntPtr processAttributes, IntPtr threadAttributes, bool inherit, uint flags, IntPtr environment, string cwd, ref STARTUPINFOEX startup, out PROCESS_INFORMATION info);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);

    static void Check(bool value) { if (!value) throw new Win32Exception(Marshal.GetLastWin32Error()); }
    // Arguments are absolute filesystem paths, not shell input. Windows forbids
    // quotes in a path; reject them rather than constructing an ambiguous command.
    static string QuotePath(string value) {
        if (String.IsNullOrEmpty(value) || !Path.IsPathRooted(value) || value.IndexOf('"') >= 0)
            throw new ArgumentException("Expected an absolute worker path");
        return "\"" + value + "\"";
    }
    public static void Run() {
        string node = Environment.GetEnvironmentVariable("UI_CRAFT_WORKER_NODE");
        string entry = Environment.GetEnvironmentVariable("UI_CRAFT_WORKER_ENTRY");
        string stop = Environment.GetEnvironmentVariable("UI_CRAFT_WORKER_STOP");
        uint parentId = UInt32.Parse(Environment.GetEnvironmentVariable("UI_CRAFT_WORKER_PARENT"));
        IntPtr parent = IntPtr.Zero, job = IntPtr.Zero, list = IntPtr.Zero, jobValue = IntPtr.Zero;
        PROCESS_INFORMATION child = new PROCESS_INFORMATION();
        bool listReady = false;
        NamedPipeClientStream input = null;
        try {
            // Pin the owner process handle before launching anything.
            parent = OpenProcess(0x00100000, false, parentId);
            if (parent == IntPtr.Zero || WaitForSingleObject(parent, 0) != 258 || File.Exists(stop)) return;
            job = CreateJobObject(IntPtr.Zero, null);
            Check(job != IntPtr.Zero);
            EXTENDED_LIMIT limits = new EXTENDED_LIMIT();
            limits.BasicLimitInformation.LimitFlags = 0x2000; // KILL_ON_JOB_CLOSE; no breakaway
            Check(SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(limits)));
            IntPtr bytes = IntPtr.Zero;
            InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref bytes);
            list = Marshal.AllocHGlobal(bytes);
            Check(InitializeProcThreadAttributeList(list, 1, 0, ref bytes));
            listReady = true;
            jobValue = Marshal.AllocHGlobal(IntPtr.Size);
            Marshal.WriteIntPtr(jobValue, job);
            // PROC_THREAD_ATTRIBUTE_JOB_LIST assigns at CreateProcess time.
            Check(UpdateProcThreadAttribute(list, 0, new IntPtr(0x2000D), jobValue, new IntPtr(IntPtr.Size), IntPtr.Zero, IntPtr.Zero));
            string pipeName = Environment.GetEnvironmentVariable("UI_CRAFT_WORKER_PIPE");
            if (!String.IsNullOrEmpty(pipeName)) {
                input = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut);
                input.Connect(10000);
                uint serverPid;
                Check(GetNamedPipeServerProcessId(input.SafePipeHandle.DangerousGetHandle(), out serverPid));
                if (serverPid != parentId) throw new Exception("Worker pipe owner mismatch");
                byte[] greeting = Encoding.UTF8.GetBytes(Environment.GetEnvironmentVariable("UI_CRAFT_WORKER_PIPE_TOKEN") + "\n");
                input.Write(greeting, 0, greeting.Length);
                input.Flush();
                Environment.SetEnvironmentVariable("UI_CRAFT_WORKER_PIPE_TOKEN", null);
            }
            STARTUPINFOEX startup = new STARTUPINFOEX();
            startup.StartupInfo.cb = Marshal.SizeOf(startup);
            startup.StartupInfo.dwFlags = 0x100; // STARTF_USESTDHANDLES
            startup.StartupInfo.hStdInput = input == null ? GetStdHandle(-10) : input.SafePipeHandle.DangerousGetHandle();
            startup.StartupInfo.hStdOutput = GetStdHandle(-11);
            startup.StartupInfo.hStdError = GetStdHandle(-12);
            foreach (IntPtr handle in new IntPtr[] { startup.StartupInfo.hStdInput, startup.StartupInfo.hStdOutput, startup.StartupInfo.hStdError })
                Check(SetHandleInformation(handle, 1, 1));
            startup.lpAttributeList = list;
            Check(CreateProcessW(node, new StringBuilder(QuotePath(node) + " " + QuotePath(entry)), IntPtr.Zero, IntPtr.Zero,
                true, 0x08080000, IntPtr.Zero, Environment.CurrentDirectory, ref startup, out child));
            Stopwatch clock = Stopwatch.StartNew();
            while (WaitForSingleObject(child.hProcess, 0) == 258 && WaitForSingleObject(parent, 0) == 258
                && !File.Exists(stop) && clock.ElapsedMilliseconds < 60000) Thread.Sleep(25);
            Check(TerminateJobObject(job, 1));
            // Exit successfully only once every process in the job has ended.
            clock.Restart();
            while (true) {
                ACCOUNTING accounting;
                Check(QueryInformationJobObject(job, 1, out accounting, (uint)Marshal.SizeOf(typeof(ACCOUNTING)), IntPtr.Zero));
                if (accounting.ActiveProcesses == 0) break;
                if (clock.ElapsedMilliseconds > 5000) throw new Exception("Owned Windows job did not drain");
                Thread.Sleep(25);
            }
        } finally {
            if (input != null) input.Dispose();
            if (child.hThread != IntPtr.Zero) CloseHandle(child.hThread);
            if (child.hProcess != IntPtr.Zero) CloseHandle(child.hProcess);
            if (job != IntPtr.Zero) CloseHandle(job);
            if (parent != IntPtr.Zero) CloseHandle(parent);
            if (listReady) DeleteProcThreadAttributeList(list);
            if (list != IntPtr.Zero) Marshal.FreeHGlobal(list);
            if (jobValue != IntPtr.Zero) Marshal.FreeHGlobal(jobValue);
        }
    }
}
