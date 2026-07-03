<?php

namespace App\Http\Controllers;

use App\Models\Device;
use Illuminate\Http\Request;

class DeviceController extends Controller
{
    public function status()
    {
        $devices = Device::all();
        $totalPower = $devices->where('status', true)->sum('power_draw');
        
        return response()->json([
            'devices' => $devices,
            'total_power' => $totalPower,
            'active_count' => $devices->where('status', true)->count(),
            'rooms' => $devices->groupBy('room')->map(function ($items, $room) {
                return [
                    'name' => $room,
                    'active_count' => $items->where('status', true)->count(),
                    'power_usage' => $items->where('status', true)->sum('power_draw'),
                ];
            })->values(),
        ]);
    }

    public function room($name)
    {
        // Handle name mapping if needed (e.g. work1 -> Work Room 1)
        $mappedName = str_ireplace(['work1', 'work2', 'drawing'], ['Work Room 1', 'Work Room 2', 'Drawing Room'], $name);
        
        $devices = Device::where('room', 'like', "%$mappedName%")->get();
        
        if ($devices->isEmpty()) {
            return response()->json(['message' => 'Room not found'], 404);
        }

        return response()->json([
            'room' => $mappedName,
            'devices' => $devices,
            'active_count' => $devices->where('status', true)->count(),
            'power_usage' => $devices->where('status', true)->sum('power_draw'),
        ]);
    }
}
