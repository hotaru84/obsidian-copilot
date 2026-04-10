# Remote Agent Selector - Complete Flow Analysis

## 1. Data Structure Definition

### Domain Model: `RemoteAgentInfo` and `SessionRemoteAgentState`
**File**: `src/domain/models/chat-session.ts`

```typescript
export interface RemoteAgentInfo {
  /** Unique identifier for this remote agent */
  agentId: string;
  /** Human-readable name for display */
  name: string;
  /** Optional description of what this agent does */
  description?: string;
}

export interface SessionRemoteAgentState {
  /** List of remote agents available from the server */
  availableAgents: RemoteAgentInfo[];
  /** ID of the currently active remote agent (null = default) */
  currentAgentId: string | null;
}
```

**Key Properties**:
- `RemoteAgentInfo.agentId` - Used to match against `currentAgentId`
- `RemoteAgentInfo.name` - Displayed in UI as the agent name
- `SessionRemoteAgentState.currentAgentId` - Should be `string | null` (not `undefined`)

---

## 2. SDK to Domain Mapping

### SDK Type: `AgentInfo` (from vendor SDK)
**File**: `vendor/copilot-runtime-sdk/sdk-client/dist/src/types.d.ts`

```typescript
export interface AgentInfo {
  id: string;           // ← Note: SDK uses 'id', not 'agentId'
  name: string;
  description?: string;
  source?: string;
  enabled?: boolean;
}
```

### Mapping in Adapter
**File**: `src/adapters/remote/remote.adapter.ts` (Lines 492-502)

```typescript
const availableRemoteAgents: RemoteAgentInfo[] = agents
  .filter((a: any) => a.enabled !== false)
  .map((a) => ({
    agentId: a.id,              // ✓ Correct: Maps SDK's 'id' → 'agentId'
    name: a.name,               // ✓ Correct: Direct mapping
    description: a.description, // ✓ Correct: Direct mapping
  }));
```

**Status**: ✓ Property mapping is correct.

---

## 3. Initialization Flow

### Step 1: SDK calls listAgents()
**Location**: `src/adapters/remote/remote.adapter.ts` - `newSession()` method

```typescript
const [models, customCommands, prompts, agents] = await Promise.all([
  client.listModels().catch(() => []),
  client.listCustomCommands().catch(() => []),
  client.listPrompts().catch(() => []),
  client.listAgents().catch(() => []),  // ← Returns AgentInfo[]
]);
```

### Step 2: Build RemoteAgentInfo from SDK response
```typescript
const availableRemoteAgents: RemoteAgentInfo[] = agents
  .filter((a: any) => a.enabled !== false)
  .map((a) => ({
    agentId: a.id,
    name: a.name,
    description: a.description,
  }));
```

### Step 3: Create SessionState with initial remoteAgents
```typescript
const state: SessionState = {
  session,
  currentModeId: "interactive",
  currentModelId: availableModels[0]?.modelId,
  currentRemoteAgentId: undefined,        // ← Initially undefined
  availableCommands: commandEntries,
  availableModels,
  availableRemoteAgents,
  messageDeltaBuffer: "",
  thoughtDeltaBuffer: "",
};
```

### Step 4: Return in NewSessionResult
```typescript
return {
  sessionId: session.sessionId,
  modes: ...,
  models: ...,
  remoteAgents: availableRemoteAgents.length > 0
    ? {
        availableAgents: availableRemoteAgents,
        currentAgentId: null,  // ← Explicitly null (correct type)
      }
    : undefined,
};
```

**Status**: ✓ Initialization correctly returns `currentAgentId: null`

---

## 4. ChatInput Component - Display Logic

**File**: `src/components/chat/ChatInput.tsx`

### Current Remote Agent Computation (Lines ~870-875)
```typescript
const currentRemoteAgent = useMemo(
  () =>
    remoteAgents?.availableAgents.find(
      (a) => a.agentId === remoteAgents.currentAgentId,  // Uses agentId and currentAgentId
    ) ?? null,
  [remoteAgents],
);
```

### Display Rendering (Lines ~1246-1260)
```typescript
{remoteAgents && remoteAgents.availableAgents.length > 0 && (
  <div
    ref={remoteAgentButtonRef}
    className="agent-client-remote-agent-selector"
    onClick={handleRemoteAgentSelectorClick}
    title={currentRemoteAgent?.description ?? "Select agent"}
  >
    <span className="agent-client-remote-agent-selector-text">
      {currentRemoteAgent?.name ?? "Default"}  // ← Shows name or "Default"
    </span>
    <span className="agent-client-remote-agent-selector-icon" ... />
  </div>
)}
```

**Status**: ✓ Computation logic is correct.

---

## 5. Remote Agent Selection Logic

**File**: `src/components/chat/ChatInput.tsx` (Lines ~885-925)

```typescript
const handleRemoteAgentSelectorClick = useCallback(() => {
  if (!remoteAgentButtonRef.current ||
      !remoteAgents?.availableAgents ||
      remoteAgents.availableAgents.length === 0) {
    return;
  }

  const menu = new Menu();
  const currentAgentId = remoteAgents.currentAgentId;

  // Option 1: Clear to default
  menu.addItem((item) => {
    item.setTitle("Default")
      .setIcon(currentAgentId === null ? "check" : "")
      .onClick(() => {
        if (onRemoteAgentChangeRef.current) {
          onRemoteAgentChangeRef.current(null);  // ← Pass null
        }
        setIsRemoteAgentDropdownOpen(false);
      });
  });

  // Option 2: Select specific agent
  for (const agent of remoteAgents.availableAgents) {
    const isActive = agent.agentId === currentAgentId;  // ✓ Correct comparison
    menu.addItem((item) => {
      item.setTitle(agent.name)
        .setIcon(isActive ? "check" : "")
        .onClick(() => {
          if (onRemoteAgentChangeRef.current) {
            onRemoteAgentChangeRef.current(agent.agentId);  // ← Pass agentId
          }
          setIsRemoteAgentDropdownOpen(false);
        });
    });
  }

  const rect = remoteAgentButtonRef.current.getBoundingClientRect();
  menu.showAtPosition({ x: rect.left, y: rect.bottom + 5 });
  setIsRemoteAgentDropdownOpen(true);
}, [remoteAgents]);
```

**Status**: ✓ Selection logic is correct.

---

## 6. Hook: setRemoteAgent (useAgentSession.ts)

**File**: `src/hooks/useAgentSession.ts` (Lines ~815-855)

```typescript
const setRemoteAgent = useCallback(
  async (agentId: string | null) => {
    if (!session.sessionId) {
      console.error("Cannot set remote agent without a session");
      return;
    }

    // Store previous for rollback
    const previousAgentId = session.remoteAgents?.currentAgentId ?? null;

    // Optimistic update - update UI immediately
    setSession((prev) => {
      if (!prev.remoteAgents) return prev;
      return {
        ...prev,
        remoteAgents: {
          ...prev.remoteAgents,
          currentAgentId: agentId,  // ← Update local state
        },
      };
    });

    try {
      // Send to adapter
      await agentClient.setSessionAgent(session.sessionId, agentId);
    } catch (error) {
      console.error("Failed to set remote agent:", error);
      // Rollback on error
      setSession((prev) => {
        if (!prev.remoteAgents) return prev;
        return {
          ...prev,
          remoteAgents: {
            ...prev.remoteAgents,
            currentAgentId: previousAgentId,  // ← Restore
          },
        };
      });
    }
  },
  [
    agentClient,
    session.sessionId,
    session.remoteAgents?.currentAgentId,
  ],
);
```

**Status**: ✓ Hook properly does optimistic update and error rollback.

---

## 7. Adapter: setSessionAgent (remote.adapter.ts)

**File**: `src/adapters/remote/remote.adapter.ts` (Lines 1173-1185)

```typescript
async setSessionAgent(
  sessionId: string,
  agentId: string | null,
): Promise<void> {
  const state = this.getSessionState(sessionId);
  if (agentId === null) {
    await state.session.clearAgent();
    state.currentRemoteAgentId = undefined;    // ⚠️ ISSUE: Sets to undefined
  } else {
    await state.session.setAgent(agentId);
    state.currentRemoteAgentId = agentId;      // ✓ Sets to agentId
  }
}
```

**Critical Issue Found**:
- When clearing the agent (`agentId === null`), the code sets `state.currentRemoteAgentId = undefined`
- The domain model expects `string | null`, not `undefined`
- This causes a type mismatch and could lead to unexpected behavior

---

## 8. Session Update Flow

There is **NO notification mechanism** for remote agent changes:
- When `setSessionAgent()` is called, it only updates the adapter's internal state
- The internal `state.currentRemoteAgentId` is never communicated back to the domain layer
- The hook's optimistic update in `setRemoteAgent()` becomes the source of truth

This means:
- ✓ UI updates immediately due to optimistic update in ChatInput
- ⚠️ If the adapter's SDK call fails but doesn't throw, the UI incorrectly shows the agent as changed
- ⚠️ The adapter's state (`state.currentRemoteAgentId`) is never synced back to verify the change succeeded

---

## 9. Potential Issues and Root Causes

### Issue 1: Type Mismatch in Adapter (CRITICAL)
**Location**: `src/adapters/remote/remote.adapter.ts:1180`

When clearing the agent:
```typescript
state.currentRemoteAgentId = undefined;  // ← Should be null
```

Should be:
```typescript
state.currentRemoteAgentId = null;  // ← Matches domain model string | null
```

**Impact**: Type inconsistency could cause issues when the state is inspected or logged.

---

### Issue 2: No Bidirectional Sync
The adapter updates its internal state but doesn't emit a session update notification:
- Hook does optimistic update and assumes success
- Adapter updates internal state but doesn't confirm it back
- UI is never explicitly synchronized with adapter's state

**Solution**: Consider emitting a `remote_agent_changed` notification (or similar) after successful change.

---

### Issue 3: Property Name Mismatch Would Occur Here
If the mapping in adapter used the wrong property, the find() in ChatInput would fail:
- SDK has `id` → Must map to `agentId` ✓
- Domain has `agentId` → Used in find() ✓
- Display uses `name` ✓

**Status**: This specific issue is NOT present in current code.

---

## 10. Complete Agent Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ SDK listAgents() returns AgentInfo[]                         │
│ {id, name, description, enabled}                            │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ Adapter maps: id → agentId                                   │
│ Creates RemoteAgentInfo[] with {agentId, name, description} │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ Returns in NewSessionResult:                                 │
│ remoteAgents: {                                              │
│   availableAgents: RemoteAgentInfo[],                        │
│   currentAgentId: null                                       │
│ }                                                            │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ useAgentSession stores in ChatSession state                  │
│ session.remoteAgents = SessionRemoteAgentState              │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ ChatInput.tsx:                                               │
│ - Displays remoteAgents.availableAgents in dropdown          │
│ - Shows currentRemoteAgent?.name or "Default"               │
│ - Checks selection with agent.agentId === currentAgentId     │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ User selects agent via handleRemoteAgentSelectorClick()      │
│ Calls onRemoteAgentChange(agent.agentId)                    │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ Hook: setRemoteAgent(agentId)                                │
│ 1. Does optimistic update to ChatSession.remoteAgents       │
│ 2. Calls agentClient.setSessionAgent()                       │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ Adapter: setSessionAgent(sessionId, agentId)                 │
│ - Calls SDK: session.setAgent(agentId) or clearAgent()      │
│ - Updates internal state.currentRemoteAgentId                │
│ ⚠️ Does NOT emit notification back                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Summary of Findings

### ✓ What Works Correctly
1. Property mapping from SDK's `id` to domain's `agentId` is correct
2. Lookup logic using `agentId === currentAgentId` is correct
3. Display logic showing `currentRemoteAgent?.name` is correct
4. Optimistic update in hook provides fast UI feedback
5. Error rollback mechanism in hook is implemented

### ⚠️ Issues Found
1. **Type mismatch**: Setting `undefined` instead of `null` when clearing agent (Line 1180)
2. **No bidirectional sync**: Adapter doesn't emit notification after change
3. **Asymmetric state management**: Hook's optimistic update is the source of truth, not adapter's state

### 🔍 Why Selected Agent Might Not Display
If the agent is NOT displaying after selection:
1. Check if `remoteAgents.availableAgents` is populated (should be non-empty)
2. Check if `remoteAgents.currentAgentId` is actually being set (should match selected `agentId`)
3. Check if the SDK's `setAgent()` call is throwing silently
4. Verify the find() is working: `a.agentId === remoteAgents.currentAgentId`
5. Confirm `currentRemoteAgent.name` exists on the matching agent object

---

## 12. Recommended Fixes

### Fix 1: Type Consistency (URGENT)
```typescript
// In remote.adapter.ts setSessionAgent(), line 1180
if (agentId === null) {
  await state.session.clearAgent();
  state.currentRemoteAgentId = null;  // ← Changed from undefined
} else {
  // ...
}
```

### Fix 2: Emit State Sync Notification (OPTIONAL)
Consider adding:
```typescript
async setSessionAgent(sessionId: string, agentId: string | null): Promise<void> {
  const state = this.getSessionState(sessionId);
  if (agentId === null) {
    await state.session.clearAgent();
    state.currentRemoteAgentId = null;
  } else {
    await state.session.setAgent(agentId);
    state.currentRemoteAgentId = agentId;
  }

  // Emit notification to keep domain state synced
  if (this.sessionUpdateCallback && state.availableRemoteAgents.length > 0) {
    this.sessionUpdateCallback({
      type: "remote_agent_changed",  // New notification type
      sessionId,
      currentAgentId: state.currentRemoteAgentId ?? null,
    });
  }
}
```

### Fix 3: Handle in Hook (OPTIONAL)
Add handler for the new notification type in useAgentSession and ChatView listener.
