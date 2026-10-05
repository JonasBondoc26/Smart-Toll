<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * The toll rate change log (toll_rate_logs).
 *
 * Every change goes through the same two steps: take a snapshot of the affected
 * rates before, change them, take a snapshot after, then record() the difference.
 * That way single admin edits, deletes that cascade from a plaza or expressway,
 * and bulk TRB / CSV imports are all logged the same way.
 *
 * A snapshot is "entryId|exitId|classId" => row with the rate and the names
 * (names are copied into the log so it stays readable after deletions).
 */
class RateLog
{
    /** Rates matching a filter: ['expressway_id' => n] | ['plaza_ids' => [..]] | ['matrix_ids' => [..]]. */
    public static function snapshot(array $filter): array
    {
        $q = DB::table('toll_matrix as m')
            ->join('toll_plazas as a', 'a.plaza_id', '=', 'm.entry_plaza_id')
            ->join('toll_plazas as b', 'b.plaza_id', '=', 'm.exit_plaza_id')
            ->join('expressways as e', 'e.expressway_id', '=', 'a.expressway_id')
            ->join('vehicle_classifications as c', 'c.classification_id', '=', 'm.classification_id');

        if (isset($filter['expressway_id'])) {
            $q->where('a.expressway_id', $filter['expressway_id']);
        }
        if (isset($filter['plaza_ids'])) {
            $ids = $filter['plaza_ids'];
            $q->where(fn ($w) => $w->whereIn('m.entry_plaza_id', $ids)->orWhereIn('m.exit_plaza_id', $ids));
        }
        if (isset($filter['matrix_ids'])) {
            $q->whereIn('m.matrix_id', $filter['matrix_ids']);
        }

        $out = [];
        foreach ($q->get(['m.entry_plaza_id', 'm.exit_plaza_id', 'm.classification_id', 'm.rate',
                          'a.plaza_name as entry_name', 'b.plaza_name as exit_name', 'c.class_name', 'e.expressway_name']) as $r) {
            $out["{$r->entry_plaza_id}|{$r->exit_plaza_id}|{$r->classification_id}"] = $r;
        }
        return $out;
    }

    /**
     * What changed between two snapshots.
     * @return array<int, array{action:string, row:object, old:?float, new:?float}>
     */
    public static function diff(array $before, array $after): array
    {
        $changes = [];
        foreach ($after as $key => $row) {
            if (!isset($before[$key])) {
                $changes[] = ['action' => 'added', 'row' => $row, 'old' => null, 'new' => (float) $row->rate];
            } elseif (round((float) $before[$key]->rate, 2) !== round((float) $row->rate, 2)) {
                $changes[] = ['action' => 'updated', 'row' => $row, 'old' => (float) $before[$key]->rate, 'new' => (float) $row->rate];
            }
        }
        foreach ($before as $key => $row) {
            if (!isset($after[$key])) {
                $changes[] = ['action' => 'deleted', 'row' => $row, 'old' => (float) $row->rate, 'new' => null];
            }
        }
        return $changes;
    }

    /** Writes the changes to toll_rate_logs. $user: the admin (null for command-line runs). */
    public static function record(array $changes, string $source, ?object $user): int
    {
        $rows = array_map(fn ($c) => [
            'action' => $c['action'], 'source' => $source,
            'expressway_name' => $c['row']->expressway_name, 'entry_name' => $c['row']->entry_name,
            'exit_name' => $c['row']->exit_name, 'class_name' => $c['row']->class_name,
            'old_rate' => $c['old'], 'new_rate' => $c['new'],
            'user_id' => $user?->user_id, 'user_name' => $user?->full_name,
            'created_at' => now(),
        ], $changes);
        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('toll_rate_logs')->insert($chunk);
        }
        return count($rows);
    }

    /** Short summary for previews: counts plus the first $limit changes. */
    public static function summarize(array $changes, int $limit = 200): array
    {
        $counts = ['added' => 0, 'updated' => 0, 'deleted' => 0];
        foreach ($changes as $c) {
            $counts[$c['action']]++;
        }
        return [
            'counts' => $counts,
            'total' => count($changes),
            'changes' => array_map(fn ($c) => [
                'action' => $c['action'], 'expressway' => $c['row']->expressway_name,
                'entry' => $c['row']->entry_name, 'exit' => $c['row']->exit_name, 'class' => $c['row']->class_name,
                'old' => $c['old'], 'new' => $c['new'],
            ], array_slice($changes, 0, $limit)),
        ];
    }
}
