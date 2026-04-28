const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    "https://bzrxpejjfzlecpugylqx.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cnhwZWpqZnpsZWNwdWd5bHF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTkxNjksImV4cCI6MjA4NDgzNTE2OX0.tS3GgxA5L969XGQK9Uw4qxTcqco1Y2iytoKcfos0DNU"
);
async function run() {
    const { data: inv, error } = await supabase.from('inventory_batches').select(`
        id, hospital_id, blood_group, units, reserved_units, expiry_date,
        hospitals ( name, min_reserve_units )
    `);
    if (error) { console.error(error); return; }
    
    inv.forEach(b => {
        if (b.units > 0) {
            console.log(`Hospital: ${b.hospitals.name}, BG: ${b.blood_group}, Units: ${b.units}, Reserved: ${b.reserved_units}, MinReserve: ${b.hospitals.min_reserve_units}`);
        }
    });
}
run();
