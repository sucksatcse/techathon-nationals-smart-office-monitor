<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Device extends Model
{
    protected $fillable = [
        'room',
        'type',
        'name',
        'status',
        'power_draw',
        'last_changed_at',
    ];

    protected $casts = [
        'status' => 'boolean',
        'last_changed_at' => 'datetime',
    ];
}
