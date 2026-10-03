<?php

namespace App\Console\Commands;

use App\Models\Expressway;

/**
 * Shared lookup used by trb:seed-plazas and trb:import.
 *
 * TRB labels the same plaza two ways in one table: a short code across
 * the header row ("BWK") and a full name down the first column
 * ("Balintawak"). Each map below turns a page's codes (and any TRB
 * misspellings) into ONE canonical plaza name, so both labels land on
 * the same toll_plazas row.
 *
 * Maps are kept PER PAGE because codes collide between pages:
 * "STR" is Sta. Rita on NLEX but Sta. Rosa on SLEX.
 *
 * The key is the first argument you pass to the commands
 * (php artisan trb:import "SLEX" ...). Keys inside each map are UPPERCASE.
 */
final class TrbCodeMap
{
    private const MAPS = [
        // nlex.html — NLEX + SCTEX integrated matrix
        'NLEX' => [
            'BWK' => 'Balintawak',
            'MIN' => 'Mindanao Avenue',
            'KAR' => 'Karuhatan',
            'VAL' => 'Valenzuela',
            'MEY' => 'Meycauayan',
            'MAR' => 'Marilao',
            'CDV' => 'Ciudad de Victoria',
            'BOC' => 'Bocaue',
            'TAM' => 'Tambubong',
            'BAL' => 'Balagtas',
            'STR' => 'Sta. Rita',
            'PUL' => 'Pulilan',
            'SNM' => 'San Simon',
            'SNF' => 'San Fernando',
            'MXC' => 'Mexico',
            'ANG' => 'Angeles',
            'DAU' => 'Dau',
            'TIPO/SFEX' => 'Tipo/SFEX',
            'DIN' => 'Dinalupihan',
            'FLOR' => 'Floridablanca',
            'PORAC' => 'Porac',
            'CLARK S' => 'Clark South',
            'MAB' => 'Mabalacat (Mabiga)',
            'CLARK N' => 'Clark North',
            'DOLORES' => 'Dolores',
            'N.CLARK C' => 'Bamban (New Clark City)',
            'CONC' => 'Concepcion',
            'S. MIGUEL' => 'San Miguel',
            'TARLAC' => 'Tarlac',
        ],

        // tplex.html — full names already; TRB misspells one row label
        'TPLEX' => [
            'POZORRUBBIO' => 'Pozorrubio',
        ],

        // slex.html — Skyway + SLEX + MCX integrated matrix
        'SLEX' => [
            'SKY' => 'Skyway (Elevated)',   // column only: no row on TRB's table
            'MAG' => 'Magallanes',          // column only: no row on TRB's table
            'C-5' => 'Merville',            // the C-5 column is the Merville row (see note in chat)
            'BIC' => 'Bicutan',
            'SUC' => 'Sucat',
            'ALA' => 'Alabang',
            'FIL' => 'Filinvest',
            'MCX' => 'Muntinlupa-Cavite Expressway (MCX)',
            "MUNTINLUPA-CAVITE X'WAY" => 'Muntinlupa-Cavite Expressway (MCX)',
            'SUS HTS' => 'Susana Heights',
            'SNP' => 'San Pedro',
            'SWOODS' => 'Southwoods',
            'CAR' => 'Carmona',
            'MAM' => 'Mamplasan',
            'STR' => 'Sta. Rosa',
            'ABI' => 'ABI/Greenfield',
            'CAB' => 'Cabuyao',
            'SIL' => 'Silangan',
            'CAL' => 'Calamba',
            'STOMAS' => 'Sto. Tomas',
        ],

        // calax.html — full names; the header spells one plaza differently from its row
        'CALAX' => [
            'STA-ROSA-TAGAYTAY' => 'Sta. Rosa-Tagaytay',
        ],

        // cavitex.html — CAVITEX + C5 Link. The last column and the last row
        // carry different labels but are the same position in TRB's square
        // matrix (their fares mirror each other), so both fold into one plaza.
        'CAVITEX' => [
            'SUCAT ROAD /DR. A SANTOS AVENUE' => 'Sucat Road / Dr. A. Santos Avenue (C5 Road Extension)',
            'SUCAT ROAD / DR. A SANTOS AVENUE' => 'Sucat Road / Dr. A. Santos Avenue (C5 Road Extension)',
            'C5 ROAD EXTENSION/C.P. GARCIA' => 'Sucat Road / Dr. A. Santos Avenue (C5 Road Extension)',
        ],

        // skyway3.html — Skyway Stage 3. Separate northbound and southbound tables
        // spell the same ramps differently.
        'SKYWAY3' => [
            'QUEZON AVE.' => 'Quezon Avenue',
            'E.RODRIGUEZ' => 'E. Rodriguez',
            'A.BONIFACIO-BALINTAWAK' => 'A. Bonifacio / Balintawak',
            'BALINTAWAK-A.BONIFACIO' => 'A. Bonifacio / Balintawak',
        ],
    ];

    /** Code map for the given command argument, or [] if that page has none yet. */
    public static function forExpressway(string $name): array
    {
        return self::MAPS[strtoupper(trim($name))] ?? [];
    }

    /**
     * Finds the expressways row for a short name like "SLEX".
     * Tries "(SLEX)" first so "SLEX" does not accidentally pick
     * "NLEX-SLEX Connector Road", then an exact name, then anything containing it.
     */
    public static function findExpressway(string $name): ?Expressway
    {
        $name = trim($name);

        return Expressway::where('expressway_name', 'like', "%({$name})%")->first()
            ?? Expressway::where('expressway_name', $name)->first()
            ?? Expressway::where('expressway_name', 'like', "%{$name}%")->first();
    }

    /** Cleans a raw cell label and resolves it through the map. */
    public static function resolve(array $map, string $raw): string
    {
        // [\s\x{00A0}] also strips non-breaking spaces, which trim() leaves behind.
        // Curly apostrophes are straightened so "X’way" matches "X'way".
        $raw = trim(preg_replace('/[\s\x{00A0}]+/u', ' ', $raw));
        $raw = str_replace(['’', '‘', '`'], "'", $raw);

        return $map[mb_strtoupper($raw)] ?? $raw;
    }
}
