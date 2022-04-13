If you don't have any data in your Mongo database, you can load sample GFF3 into it as following:

1. Connect into your MongoDb. Update also database connection string in .development.env file.

2. In MongoShell, run the following commands
use apolloDb                        -- This creates new database apolloDb, if it doesn't exist yet. 
db.createCollection('assemblies')   -- Create Assembly collection 
db.createCollection('refseqs')      -- Create RefSeq collection 
db.createCollection('features')     -- Create Features collection

3. Import test data into your new collections. Open a new OS terminal (not Mongo shell) and run there the following commands
mongoimport --db=apolloDb --collection=assemblies --file=assemblies.json --jsonArray       -- This loads data into assemblies -collection
mongoimport —-db=apolloDb —-collection=refseqs —-file=refseqs.json --jsonArray             -- This loads data into refseqs -collection
mongoimport —-db apolloDb —-collection=features —-file=features.json --jsonArray           -- This loads data into features -collection