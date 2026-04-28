const SUPABASE_URL = "https://bzrxpejjfzlecpugylqx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cnhwZWpqZnpsZWNwdWd5bHF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTkxNjksImV4cCI6MjA4NDgzNTE2OX0.tS3GgxA5L969XGQK9Uw4qxTcqco1Y2iytoKcfos0DNU";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("Supabase initialized:", supabase);

// ----------------------------------------------------
// Global State & Auth
// ----------------------------------------------------
window.CURRENT_HOSPITAL_ID = null;
let MIN_RESERVE_UNITS = 10; // Default, overwritten during auth
let localInventoryState = {};

async function getCurrentHospitalId() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        console.error("Auth error or no user session:", userError);
        return null;
    }

    // Step 2 & 3: Direct Primary Key mapping Auth identity to Hospital
    let { data: hospital, error } = await supabase
        .from('hospitals')
        .select('*')
        .eq('id', user.id)
        .single();

    // Step 4: Auto-create securely scaling identity
    if (error || !hospital) {
        const { data: newHospital, error: insertError } = await supabase
            .from('hospitals')
            .insert({
                id: user.id,
                email: user.email,
                name: "New Hospital",
                verified: false,
                min_reserve_units: 10
            })
            .select('*')
            .single();

        if (insertError) {
            console.error("Auto-creation failed:", insertError.message);
            alert("⚠️ Initialization failed. Contact system admin.");
            return null;
        }
        hospital = newHospital;
    }

    // Explicit Step 6: Set Global Context 1-to-1
    window.CURRENT_HOSPITAL_ID = hospital.id;
    console.log("CURRENT HOSPITAL PRIMARY KEY BOUND:", hospital);

    MIN_RESERVE_UNITS = hospital.min_reserve_units || 0;
    return hospital.id;
}

document.addEventListener("DOMContentLoaded", async () => {
    // --- DEBUG: STEP 3 (CHECK AUTH) ---
    const { data: { user } } = await supabase.auth.getUser();
    console.log("USER:", user);

    // --- DEBUG: STEP 1 & 2 (RAW FETCH) ---
    const { data: dbHospitals, error: dbErr } = await supabase.from('hospitals').select('*');
    if (dbErr) {
        console.error("Hospitals fetch error:", dbErr);
    } else {
        console.log("HOSPITALS RAW DATA:", dbHospitals);
    }

    const linkedHospId = await getCurrentHospitalId();
    if (!linkedHospId) {
        // Explicit Step 3: STOP further execution
        return;
    }

    initTabs();
    initInventoryMgmt();
    initRequestCreation();
    initIncomingAllocations();
    initTransactions();

    loadInventoryData();
    loadMyRequests();
    loadIncomingRequests();
    loadTransactionsData();

    document.getElementById("themeBtn")?.addEventListener("click", () => document.body.classList.toggle("dark-theme"));
    document.getElementById("saveInventoryBtn")?.addEventListener("click", saveInventoryData);
    document.getElementById("createRequestBtn")?.addEventListener("click", submitNewRequest);
    document.getElementById("profileBtn")?.addEventListener("click", () => {
        if (window.CURRENT_HOSPITAL_ID) {
            window.location.href = `hospital-profile.html?id=${window.CURRENT_HOSPITAL_ID}`;
        } else {
            alert("Hospital ID not found. Return to login.");
        }
    });
});

// ----------------------------------------------------
// 1. Tab Navigation
// ----------------------------------------------------
function initTabs() {
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            tabLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            link.classList.add('active');
            const target = document.getElementById(link.dataset.tab);
            if (target) target.classList.add('active');

            if (link.dataset.tab === 'tab-inventory') loadInventoryData();
            if (link.dataset.tab === 'tab-requests') loadMyRequests();
            if (link.dataset.tab === 'tab-incoming') loadIncomingRequests();
            if (link.dataset.tab === 'tab-transactions') loadTransactionsData();
        });
    });
}

// ----------------------------------------------------
// 2. Inventory Management (Strict Mathematics)
// ----------------------------------------------------
function initInventoryMgmt() {
    window.adjustInventory = (id, amount) => {
        if (!localInventoryState[id]) return;
        let obj = localInventoryState[id];
        let newVal = obj.units + amount;
        if (newVal < 0) newVal = 0;
        obj.units = newVal;

        document.getElementById(`inv-val-${id}`).innerText = newVal;

        const available = Math.max(0, newVal - obj.reserved_units - MIN_RESERVE_UNITS);
        document.getElementById(`inv-avail-${id}`).innerText = available;
        document.getElementById(`inv-avail-${id}`).style.color = available > 0 ? '#20e3b2' : '#ff4757';
    };
}

async function loadInventoryData() {
    const tbody = document.getElementById("inventoryBody");
    if (!tbody) return;

    // Filter Step 5: .eq('hospital_id', CURRENT_HOSPITAL_ID)
    const { data: inventory, error } = await supabase
        .from('inventory_batches')
        .select('*')
        .eq('hospital_id', window.CURRENT_HOSPITAL_ID)
        .eq('is_recalled', false)
        .order('blood_group', { ascending: true });

    if (error || !inventory || inventory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">No active inventory found.</td></tr>`;
        return;
    }

    localInventoryState = {};
    tbody.innerHTML = "";

    inventory.forEach(batch => {
        const reserved = batch.reserved_units || 0;
        localInventoryState[batch.id] = { id: batch.id, units: batch.units, reserved_units: reserved };

        const available = Math.max(0, batch.units - reserved - MIN_RESERVE_UNITS);

        tbody.innerHTML += `
            <tr>
                <td><strong style="color: #20e3b2;">${batch.blood_group}</strong></td>
                <td><span id="inv-val-${batch.id}" style="font-weight:bold; font-size:16px;">${batch.units}</span></td>
                <td><span style="color:#facc15;">${reserved}</span></td>
                <td><span id="inv-avail-${batch.id}" style="color:${available > 0 ? '#20e3b2' : '#ff4757'}">${available}</span></td>
                <td>
                    <div class="counter-control">
                        <button class="counter-btn" onclick="adjustInventory('${batch.id}', -1)">-</button>
                        <button class="counter-btn" onclick="adjustInventory('${batch.id}', 1)">+</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

async function saveInventoryData() {
    const btn = document.getElementById("saveInventoryBtn");
    btn.innerText = "Saving...";

    for (const v of Object.values(localInventoryState)) {
        await supabase.from('inventory_batches').update({ units: v.units }).eq('id', v.id);
    }

    btn.innerText = "Saved!";
    setTimeout(() => btn.innerText = "Save Changes", 2000);
    loadInventoryData();
}

// ----------------------------------------------------
// 3. Request Engine & RPC Invocation
// ----------------------------------------------------
function initRequestCreation() { }

async function submitNewRequest() {
    const bg = document.getElementById('reqBloodGroup').value;
    const units = parseInt(document.getElementById('reqUnits').value);
    const prio = document.getElementById('reqPriority').value;

    if (!bg || isNaN(units) || units < 1) return alert("Invalid inputs.");

    document.getElementById('createRequestBtn').disabled = true;

    try {
        // Step 1: Explicitly insert request locally
        const { data: newReq, error: insertErr } = await supabase.from('blood_requests').insert({
            hospital_id: window.CURRENT_HOSPITAL_ID,
            blood_group: bg,
            units_required: units,
            priority_level: prio || 'Routine',
            status: 'pending'
        }).select().single();

        if (insertErr || !newReq) throw new Error(insertErr?.message || "Failed to create request");

        // Step 2: Offload matcher execution natively up to Node.js Backend ONLY if Urgent/Emergency
        if (prio === 'Urgent' || prio === 'Emergency') {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch('http://localhost:5050/api/match', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token || ''}`
                },
                body: JSON.stringify({ request_id: newReq.id })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Backend matching failure");
            alert("Emergency request generated and automatically matched!");
        } else {
            alert("Routine request successfully broadcasted to the open network! Any hospital can now fulfill it.");
        }

        document.getElementById('reqBloodGroup').value = "";
        document.getElementById('reqUnits').value = "";
        
        loadMyRequests();
    } catch (err) {
        alert("Application Engine Error: " + err.message);
    } finally {
        document.getElementById('createRequestBtn').disabled = false;
    }
}

window.runSmartMatch = async function (reqId) {
    if (!confirm("Trigger Backend Express execution for matches?")) return;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch('http://localhost:5050/api/match', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token || ''}`
            },
            body: JSON.stringify({ request_id: reqId })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        alert("Express Match Engine Processed!");
        loadMyRequests();
    } catch (err) {
        alert("Node.js Engine Error: " + err.message);
    }
};

async function loadMyRequests() {
    const list = document.getElementById("myRequestsList");
    if (!list) return;

    console.log("Fetching requests for hospital:", window.CURRENT_HOSPITAL_ID);

    // Explicit Step 2: Properly fetch the nested relationships
    const { data: requests, error } = await supabase
        .from("blood_requests")
        .select('*, request_allocations(*, hospitals:supplier_hospital_id(name))')
        .eq("hospital_id", window.CURRENT_HOSPITAL_ID)
        .order("created_at", { ascending: false });

    // Explicit Step 5: Handle Error precisely
    if (error) {
        console.error("REQUEST FETCH ERROR:", error);
        return (list.innerHTML = "<p style='color:red;'>Failed to load requests.</p>");
    }

    if (!requests || requests.length === 0) return (list.innerHTML = "<p>No requests.</p>");

    list.innerHTML = "";
    requests.forEach(r => {
        const allocs = r.request_allocations || [];
        const totalAllocated = allocs.reduce((sum, a) => sum + parseInt(a.units_allocated), 0);

        let allocHtml = allocs.map(a => `
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.05); padding: 4px 0; font-size:12px;">
                <span>${a.units_allocated}u ⬅️ <b>${a.hospitals?.name || 'Network'}</b></span>
                <span style="font-weight:bold; color: ${a.status === 'PENDING' ? '#facc15' : (a.status === 'ACCEPTED' ? '#20e3b2' : '#ff4757')};">[${a.status}]</span>
            </div>
        `).join('');

        let matchBtn = (r.status === 'PENDING' || r.status === 'PARTIAL')
            ? `<button style="background:transparent; border:1px solid #20e3b2; color:#20e3b2; padding:4px 8px; font-size:11px; cursor:pointer;" onclick="runSmartMatch('${r.id}')">Run Match RPC ⚡</button>`
            : '';

        list.innerHTML += `
            <div style="background: rgba(255,255,255,0.08); padding: 15px; margin-bottom: 15px; border-radius: 8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color: #20e3b2; font-size: 16px;">${r.blood_group} &nbsp; <span style="font-size:12px; color:#94a3b8;">${r.priority_level || 'Normal'}</span></strong>
                    ${matchBtn}
                </div>
                
                <div style="margin-top: 10px; font-size: 13px; display: flex; justify-content: space-between;">
                     <span>Required <b>${r.units_required}</b></span>
                     <span>Allocated <b style="color:#20e3b2;">${totalAllocated}</b></span>
                </div>

                <div style="margin-top: 12px; background: rgba(0,0,0,0.2); padding: 5px 10px;">
                    ${allocs.length > 0 ? allocHtml : '<span style="font-size:11px; color:#94a3b8;">No allocations triggered.</span>'}
                </div>
            </div>
        `;
    });
}

// ----------------------------------------------------
// 4. Sender Allocation Decisions
// ----------------------------------------------------
function initIncomingAllocations() {
    window.processAllocation = async (allocId, reqId, batchId, receiverId, bloodGroup, units, action) => {
        if (!confirm(`Commit to ${action} this allocation?`)) return;

        try {
            if (action === 'REJECT') {
                const { error } = await supabase.rpc('rpc_reject_allocation', { p_allocation_id: allocId });
                if (error) throw error;
            } else if (action === 'ACCEPT') {
                const { error, data } = await supabase.rpc('rpc_accept_allocation', { p_allocation_id: allocId });
                if (error) throw error;
                if (data && data.success === false) throw new Error(data.error);
            }
            alert(`Execution completed via RPC.`);
            loadIncomingRequests();
            loadTransactionsData();
        } catch (e) {
            alert("Backend Execution Error: " + e.message);
        }
    };
}

async function loadIncomingRequests() {
    const tbody = document.getElementById("incomingRequestsBody");
    if (!tbody) return;

    console.log("Fetching global network requests...");

    const { data: incoming, error } = await supabase
        .from('blood_requests')
        .select('*')
        .eq('status', 'pending')
        .neq('hospital_id', window.CURRENT_HOSPITAL_ID);

    if (error) {
        console.error("GLOBAL REQUESTS FETCH ERROR:", error);
        return (tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Failed to load global requests.</td></tr>`);
    }

    if (!incoming || incoming.length === 0) {
        return (tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No open network requests.</td></tr>`);
    }

    const reqHospIds = incoming.map(i => i.hospital_id).filter(Boolean);
    let hMap = {};
    if (reqHospIds.length > 0) {
        const { data: hData } = await supabase.from('hospitals').select('id, name').in('id', Array.from(new Set(reqHospIds)));
        if (hData) hData.forEach(h => hMap[h.id] = h.name);
    }

    tbody.innerHTML = "";
    incoming.forEach(req => {
        const receiverName = req.hospital_id ? hMap[req.hospital_id] : 'Unknown Hospital';
        tbody.innerHTML += `
            <tr>
                <td><span style="color:#20e3b2; font-weight:bold;">${receiverName}</span></td>
                <td><span style="color:#ff4757; font-weight:bold;">${req.blood_group || 'Unknown'}</span></td>
                <td><strong>${req.units_required}</strong> units</td>
                <td><span style="color:#facc15;">${req.priority_level}</span></td>
                <td>
                    <button style="background:#10b981; border:none; color:white; padding:4px 8px; border-radius:4px; cursor:pointer;" onclick="fulfillGlobalRequest('${req.id}')">FULFILL REQUEST</button>
                </td>
            </tr>
        `;
    });
}

window.fulfillGlobalRequest = async function(reqId) {
    if (!confirm("Are you sure you want to fulfill this request using your own inventory?")) return;
    
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('http://localhost:5050/api/match/fulfill-global', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token || ''}`
            },
            body: JSON.stringify({
                request_id: reqId,
                supplier_hospital_id: window.CURRENT_HOSPITAL_ID
            })
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Server error');
        
        alert("Success! You have fulfilled the request. The transfer is now IN_TRANSIT.");
        loadIncomingRequests();
        loadTransactionsData();
    } catch (e) {
        alert("Failed to fulfill: " + e.message);
    }
}

// ----------------------------------------------------
// 5. Transactions Logic
// ----------------------------------------------------
function initTransactions() {
    window.downloadPDF = (transferId, date, sender, receiver, bg, units, status) => {
        const safeSender = decodeURIComponent(sender);
        const safeReceiver = decodeURIComponent(receiver);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html><head><title>Transfer Receipt</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                .header { border-bottom: 2px solid #20e3b2; padding-bottom: 20px; margin-bottom: 30px; }
                h1 { color: #ff4757; margin:0; }
                .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                .label { font-weight: bold; color: #666; }
            </style>
            </head><body>
            <div class="header">
                <h1>Blood Buddy - Transfer Document</h1>
                <p>Official Transaction Receipt</p>
            </div>
            <div class="row"><span class="label">Transfer ID</span><span>${transferId}</span></div>
            <div class="row"><span class="label">Date</span><span>${date}</span></div>
            <div class="row"><span class="label">Sender Hospital</span><span>${safeSender}</span></div>
            <div class="row"><span class="label">Receiver Hospital</span><span>${safeReceiver}</span></div>
            <div class="row"><span class="label">Blood Group</span><span style="font-size:20px; font-weight:bold; color:#ff4757;">${bg}</span></div>
            <div class="row"><span class="label">Units</span><span>${units}</span></div>
            <div class="row"><span class="label">Status</span><span>${status}</span></div>
            <div style="margin-top: 50px; text-align:center; font-size:12px; color:#999;">
                System Generated Document - Blood Donation Network
            </div>
            <script>
                window.onload = function() { window.print(); }
            </script>
            </body></html>
        `);
        printWindow.document.close();
    };

    window.markReceived = async (transferId, bloodGroup, units) => {
        if (!confirm(`Mark ${units} units of ${bloodGroup} as physically received and add to inventory?`)) return;
        
        // 1. Update transfer status
        const { error: txErr } = await supabase.from('blood_transfers')
            .update({ status: 'COMPLETED' })
            .eq('id', transferId);
        if (txErr) return alert("Error updating transfer: " + txErr.message);

        // 2. Add to inventory
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 35);

        const { error: invErr } = await supabase.from('inventory_batches')
            .insert({
                hospital_id: window.CURRENT_HOSPITAL_ID,
                blood_group: bloodGroup,
                units: units,
                reserved_units: 0,
                expiry_date: expiry.toISOString(),
                is_recalled: false
            });
        if (invErr) return alert("Error adding to inventory: " + invErr.message);

        alert("Successfully received! Stock has been added to your inventory.");
        loadTransactionsData();
    };
}

async function loadTransactionsData() {
    const tbody = document.getElementById("transactionsBody");
    if (!tbody) return;

    const { data: txs, error } = await supabase
        .from('blood_transfers')
        .select(`id, blood_group, units, status, created_at, sender_id, receiver_id`)
        .or(`sender_id.eq.${window.CURRENT_HOSPITAL_ID},receiver_id.eq.${window.CURRENT_HOSPITAL_ID}`)
        .order('created_at', { ascending: false });

    if (error || !txs || txs.length === 0) {
        return (tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No transfer records.</td></tr>`);
    }

    const hSet = new Set();
    txs.forEach(t => { 
        if (t.sender_id) hSet.add(t.sender_id); 
        if (t.receiver_id) hSet.add(t.receiver_id); 
    });
    
    const validIds = Array.from(hSet);
    const hMap = {};
    
    if (validIds.length > 0) {
        const { data: hData } = await supabase.from('hospitals').select('id, name').in('id', validIds);
        if (hData) hData.forEach(h => hMap[h.id] = h.name);
    }

    tbody.innerHTML = "";

    // Sort logically to display IN_TRANSIT first, and by relation
    const sortScore = (t) => {
        let score = 0;
        if (t.status === 'IN_TRANSIT') score += 10;
        if (t.sender_id === window.CURRENT_HOSPITAL_ID) score += 5; // Outgoing gets priority in visual scan
        return score;
    };

    txs.sort((a, b) => sortScore(b) - sortScore(a));

    txs.forEach(t => {
        const isSender = t.sender_id === window.CURRENT_HOSPITAL_ID;
        const myRole = isSender ? `<span style="background:#ff4757; color:white; padding:2px 6px; border-radius:4px; font-size:10px;">OUTGOING</span>` : `<span style="background:#20e3b2; color:black; padding:2px 6px; border-radius:4px; font-size:10px;">INCOMING</span>`;
        const theirName = isSender ? hMap[t.receiver_id] : hMap[t.sender_id];

        const statColor = t.status === 'COMPLETED' ? '#20e3b2' : (t.status === 'IN_TRANSIT' ? '#facc15' : 'white');

        tbody.innerHTML += `
            <tr>
                <td>${myRole}</td>
                <td style="font-size:12px;">${new Date(t.created_at).toLocaleDateString()}</td>
                <td>${isSender ? '<span style="color:#20e3b2;">(You)</span>' : theirName}</td>
                <td>${!isSender ? '<span style="color:#20e3b2;">(You)</span>' : theirName}</td>
                <td><strong style="color:white;">${t.blood_group}</strong> (${t.units}u)</td>
                <td><strong style="color:${statColor};">${t.status}</strong></td>
                <td>
                    <button style="background:transparent; border:1px solid white; color:white; font-size:11px; padding:2px 6px; cursor:pointer;" onclick="downloadPDF('${t.id}', '${new Date(t.created_at).toLocaleDateString()}', encodeURIComponent('${(hMap[t.sender_id] || 'Unknown').replace(/'/g, "\\'")}'), encodeURIComponent('${(hMap[t.receiver_id] || 'Unknown').replace(/'/g, "\\'")}'), '${t.blood_group}', ${t.units}, '${t.status}')">PDF</button>
                    ${(!isSender && t.status === 'IN_TRANSIT') ? `<button style="background:#20e3b2; border:none; color:black; font-weight:bold; font-size:11px; padding:3px 8px; border-radius:4px; cursor:pointer; margin-left:5px;" onclick="markReceived('${t.id}', '${t.blood_group}', ${t.units})">Receive 📥</button>` : ''}
                </td>
            </tr>
        `;
    });
}