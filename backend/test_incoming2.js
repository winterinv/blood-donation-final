const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    "https://bzrxpejjfzlecpugylqx.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cnhwZWpqZnpsZWNwdWd5bHF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTkxNjksImV4cCI6MjA4NDgzNTE2OX0.tS3GgxA5L969XGQK9Uw4qxTcqco1Y2iytoKcfos0DNU"
);

async function test() {
    const { data: incoming3, error: err3 } = await supabase
        .from('request_allocations')
        .select('*, blood_requests(*)')
        .limit(1);
        
    if (err3) {
        console.error("ERROR 3:", err3);
    } else {
        console.log("SUCCESS 3", JSON.stringify(incoming3, null, 2));
    }
}
test();
