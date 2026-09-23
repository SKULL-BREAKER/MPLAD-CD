with open('reports/gate_log.txt', 'a', encoding='utf-8') as f:
    f.write("\nStep 03 closure: prior round's 9-FP impact list was incorrect - true FP count is 4 (255/259). Six listed works were never in the caught set; guard prose descriptions drifted; the committed code is authoritative.\n")
    f.write("Minimum stored D1 match score on seed 42 is 0.946. d1_primary (0.92) is dead config - the guard (is_p2/is_p6) routing is what actually gates the caught set.\n")
    f.write("The two double-labeled family works are W-001993 and W-002029 (labeled both P2 and P6).\n")
