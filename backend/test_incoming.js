const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    "https://bzrxpejjfzlecpugylqx.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cnhwZWpqZnpsZWNwdWd5bHF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTkxNjksImV4cCI6MjA4NDgzNTE2OX0.tS3GgxA5L969XGQK9Uw4qxTcqco1Y2iytoKcfos0DNU"
);

async function test() {
    const { data: incoming, error } = await supabase
        .from('request_allocations')
        .select('*, blood_requests!inner(*, hospitals:hospital_id(name))')
        .limit(1);

    if (error) {
        console.error("ERROR 1:", error);
    } else {
        console.log("SUCCESS 1", JSON.stringify(incoming, null, 2));
    }
    
    const { data: incoming2, error: err2 } = await supabase
        .from('request_allocations')
        .select('*, blood_requests(*, hospitals(*))')
        .limit(1);
        
    if (err2) {
        console.error("ERROR 2:", err2);
    } else {
        console.log("SUCCESS 2", JSON.stringify(incoming2, null, 2));
    }
}
test();
