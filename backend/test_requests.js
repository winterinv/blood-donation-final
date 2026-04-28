const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    "https://bzrxpejjfzlecpugylqx.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cnhwZWpqZnpsZWNwdWd5bHF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTkxNjksImV4cCI6MjA4NDgzNTE2OX0.tS3GgxA5L969XGQK9Uw4qxTcqco1Y2iytoKcfos0DNU"
);

async function run() {
    const { data: reqs, error } = await supabase.from('blood_requests').select('*').order('created_at', { ascending: false }).limit(5);
    if (error) console.error(error);
    else {
        reqs.forEach(r => {
            console.log(`ID: ${r.id}, BG: ${r.blood_group}, Prio: ${r.priority_level}, Status: ${r.status}, Req: ${r.units_required}`);
        });
    }
}
run();
