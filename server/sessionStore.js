// sessionStore.js
let session = {
  status: 'idle',       // idle | running | paused | cancelled | complete
  profile: null,        // extracted resume data
  fields: [],           // [{label, value, status: queued|active|done|skipped}]
  overrides: {},        // {fieldLabel: newValue} from user instructions
  sseClients: [],       // connected frontend listeners
};

function getSession() { return session; }

function resetSession() {
  session = { status: 'idle', profile: null, fields: [], overrides: {}, sseClients: [] };
}

function emit(event) {
  session.sseClients.forEach(res => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });
}

module.exports = { getSession, resetSession, emit };