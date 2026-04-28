const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    "https://bzrxpejjfzlecpugylqx.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cnhwZWpqZnpsZWNwdWd5bHF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTkxNjksImV4cCI6MjA4NDgzNTE2OX0.tS3GgxA5L969XGQK9Uw4qxTcqco1Y2iytoKcfos0DNU"
);

async function run() {
    const { data, error } = await supabase
        .from("blood_requests")
        .select('*, request_allocations(*, hospitals:supplier_hospital_id(name))')
        .limit(1);
    if (error) console.error("Error:", error);
    else console.log("Success:", JSON.stringify(data, null, 2));
}
run();
