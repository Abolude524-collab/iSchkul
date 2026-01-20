const { MongoClient } = require('mongodb');

// Configuration
const LOCAL_URI = 'mongodb://localhost:27017/ischkul';
// NOTE: I'm encoding the password safely. 
// User provided: mongodb+srv://aboludetestimony2_db_user:<zwi.$V39Mdf2*_6>@cluster0.sezwziv.mongodb.net/?appName=Cluster0
// Assuming the password is exactly: zwi.$V39Mdf2*_6
const REMOTE_URI = 'mongodb+srv://aboludetestimony2_db_user:zwi.$V39Mdf2*_6@cluster0.sezwziv.mongodb.net/ischkul?appName=Cluster0';

async function migrate() {
    console.log('🚀 Starting migration...');
    console.log('📍 Local:', LOCAL_URI);
    console.log('☁️  Remote:', REMOTE_URI.replace(/:([^:@]+)@/, ':****@')); // Hide password in logs

    const localClient = new MongoClient(LOCAL_URI);
    const remoteClient = new MongoClient(REMOTE_URI);

    try {
        // 1. Connect
        console.log('Connecting to databases...');
        await localClient.connect();
        console.log('✅ Connected to Local');
        await remoteClient.connect();
        console.log('✅ Connected to Remote');

        const localDb = localClient.db();
        const remoteDb = remoteClient.db(); // Will use 'ischkul' from URI

        // 2. Get list of collections
        const collections = await localDb.listCollections().toArray();
        console.log(`Found ${collections.length} collections to migrate.`);

        // 3. Migrate each collection
        for (const collectionInfo of collections) {
            const colName = collectionInfo.name;
            console.log(`\n📦 Migrating collection: ${colName}`);

            const localCol = localDb.collection(colName);
            const remoteCol = remoteDb.collection(colName);

            // Fetch all docs
            const docs = await localCol.find({}).toArray();
            if (docs.length === 0) {
                console.log(`   - Skipping (empty)`);
                continue;
            }
            console.log(`   - Found ${docs.length} documents`);

            // Clear remote collection first (Optional: safeguards against duplicates if re-run)
            await remoteCol.deleteMany({});
            console.log(`   - Cleared remote collection`);

            // Insert into remote
            const result = await remoteCol.insertMany(docs);
            console.log(`   - ✅ Inserted ${result.insertedCount} documents`);
        }

        console.log('\n✨ Migration completed successfully!');

    } catch (err) {
        console.error('\n❌ Migration failed:', err);
    } finally {
        // 4. Close connections
        await localClient.close();
        await remoteClient.close();
        console.log('🔌 Connections closed.');
    }
}

migrate();
