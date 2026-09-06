import asyncio
import sys
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def inspect_database(table_filter=None):
    async with AsyncSessionLocal() as session:
        # Get all public tables
        res = await session.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """))
        tables = [r[0] for r in res.fetchall()]
        
        print("\n" + "=" * 80)
        print("  DEALFLOW360 - POSTGRESQL DATABASE INSPECTOR")
        print("=" * 80)
        
        if table_filter:
            tables = [t for t in tables if table_filter.lower() in t.lower()]
            if not tables:
                print(f"No tables matching '{table_filter}'.")
                return

        print("\nSummary of Tables & Record Counts:")
        print("-" * 50)
        table_counts = []
        for table in tables:
            count_res = await session.execute(text(f'SELECT COUNT(*) FROM "{table}"'))
            count = count_res.scalar()
            table_counts.append((table, count))
            print(f"  * {table.ljust(30)} : {count} rows")
        
        print("\n" + "=" * 80)
        print("  DETAILED RECORDS PER TABLE")
        print("=" * 80)
        
        for table, count in table_counts:
            print(f"\n[TABLE: {table.upper()}] ({count} total records)")
            print("-" * 80)
            
            limit = 10 if not table_filter else 50
            rows_res = await session.execute(text(f'SELECT * FROM "{table}" LIMIT {limit}'))
            columns = list(rows_res.keys())
            rows = rows_res.fetchall()
            
            if not rows:
                print("  (Empty table)")
            else:
                for idx, row in enumerate(rows, 1):
                    print(f"  #{idx}:")
                    for col, val in zip(columns, row):
                        val_str = str(val)
                        if len(val_str) > 80:
                            val_str = val_str[:77] + "..."
                        print(f"     {col.ljust(22)}: {val_str}")
                    print()
                    
        print("=" * 80 + "\n")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(inspect_database(target))
