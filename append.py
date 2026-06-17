code = """
@app.route('/api/leaderboard', methods=['GET'])
def leaderboard():
    filter_type = request.args.get('filter', 'all_time')
    user = get_session_user()
    current_email = user['email'] if user else None
    
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        
        if filter_type == 'weekly':
            seven_days_ago = time.time() - (7 * 24 * 3600)
            c.execute('''
                SELECT u.email, u.username, u.avatar_url, u.level,
                       (SELECT COUNT(*) FROM reader_points_log r WHERE r.email = u.email AND r.earned_at >= ?) as weekly_points,
                       u.points as total_points,
                       (SELECT COUNT(DISTINCT manga_id) FROM reader_points_log WHERE email = u.email) as chapters_read,
                       (SELECT COUNT(*) FROM follows WHERE following_email = u.email) as followers
                FROM users u
                WHERE u.role != 'admin'
                ORDER BY weekly_points DESC, u.points DESC
                LIMIT 100
            ''', (seven_days_ago,))
        elif filter_type == 'level':
            c.execute('''
                SELECT email, username, avatar_url, level, points, points as total_points,
                       (SELECT COUNT(DISTINCT manga_id) FROM reader_points_log WHERE email = u.email) as chapters_read,
                       (SELECT COUNT(*) FROM follows WHERE following_email = u.email) as followers
                FROM users WHERE role != 'admin'
                ORDER BY level DESC, points DESC
                LIMIT 100
            ''')
        else:
            c.execute('''
                SELECT email, username, avatar_url, level, points, points as total_points,
                       (SELECT COUNT(DISTINCT manga_id) FROM reader_points_log WHERE email = u.email) as chapters_read,
                       (SELECT COUNT(*) FROM follows WHERE following_email = u.email) as followers
                FROM users WHERE role != 'admin'
                ORDER BY points DESC
                LIMIT 100
            ''')
            
        rows = c.fetchall()
        results = []
        current_user_rank = None
        current_user_data = None
        
        for i, row in enumerate(rows, 1):
            email, username, avatar_url, level, score, total_points, chapters_read, followers = row
            
            res_obj = {
                'rank': i,
                'username': username or email.split('@')[0],
                'avatar_url': avatar_url or '',
                'level': level,
                'points': total_points,
                'score': score,
                'rank_name': get_rank_name(level),
                'chapters_read': chapters_read,
                'followers': followers
            }
            results.append(res_obj)
            
            if current_email and email == current_email:
                current_user_rank = i
                current_user_data = res_obj
                
        if current_email and not current_user_rank:
            if filter_type == 'weekly':
                c.execute('''
                    SELECT 
                        (SELECT COUNT(*) FROM reader_points_log r WHERE r.email = u.email AND r.earned_at >= ?) as weekly_points,
                        u.points, u.level, u.username, u.avatar_url,
                        (SELECT COUNT(DISTINCT manga_id) FROM reader_points_log WHERE email = u.email) as chapters_read,
                        (SELECT COUNT(*) FROM follows WHERE following_email = u.email) as followers
                    FROM users u WHERE u.email = ?
                ''', (seven_days_ago, current_email))
                user_row = c.fetchone()
                if user_row:
                    my_score, my_total, my_level, my_username, my_avatar, my_ch, my_f = user_row
                    c.execute('''
                        SELECT COUNT(*) FROM (
                            SELECT u.email, (SELECT COUNT(*) FROM reader_points_log r WHERE r.email = u.email AND r.earned_at >= ?) as wp
                            FROM users u WHERE u.role != 'admin'
                        ) WHERE wp > ?
                    ''', (seven_days_ago, my_score))
                    rank_offset = c.fetchone()[0] + 1
                    
                    current_user_data = {
                        'rank': rank_offset,
                        'username': my_username or current_email.split('@')[0],
                        'avatar_url': my_avatar or '',
                        'level': my_level,
                        'points': my_total,
                        'score': my_score,
                        'rank_name': get_rank_name(my_level),
                        'chapters_read': my_ch,
                        'followers': my_f
                    }
            elif filter_type == 'level':
                c.execute("SELECT level, points, username, avatar_url, (SELECT COUNT(DISTINCT manga_id) FROM reader_points_log WHERE email = u.email) as chapters_read, (SELECT COUNT(*) FROM follows WHERE following_email = u.email) as followers FROM users WHERE email = ?", (current_email,))
                user_row = c.fetchone()
                if user_row:
                    my_level, my_points, my_username, my_avatar, my_ch, my_f = user_row
                    c.execute("SELECT COUNT(*) FROM users WHERE role != 'admin' AND (level > ? OR (level = ? AND points > ?))", (my_level, my_level, my_points))
                    rank_offset = c.fetchone()[0] + 1
                    
                    current_user_data = {
                        'rank': rank_offset,
                        'username': my_username or current_email.split('@')[0],
                        'avatar_url': my_avatar or '',
                        'level': my_level,
                        'points': my_points,
                        'score': my_level,
                        'rank_name': get_rank_name(my_level),
                        'chapters_read': my_ch,
                        'followers': my_f
                    }
            else:
                c.execute("SELECT points, level, username, avatar_url, (SELECT COUNT(DISTINCT manga_id) FROM reader_points_log WHERE email = u.email) as chapters_read, (SELECT COUNT(*) FROM follows WHERE following_email = u.email) as followers FROM users WHERE email = ?", (current_email,))
                user_row = c.fetchone()
                if user_row:
                    my_points, my_level, my_username, my_avatar, my_ch, my_f = user_row
                    c.execute("SELECT COUNT(*) FROM users WHERE role != 'admin' AND points > ?", (my_points,))
                    rank_offset = c.fetchone()[0] + 1
                    
                    current_user_data = {
                        'rank': rank_offset,
                        'username': my_username or current_email.split('@')[0],
                        'avatar_url': my_avatar or '',
                        'level': my_level,
                        'points': my_points,
                        'score': my_points,
                        'rank_name': get_rank_name(my_level),
                        'chapters_read': my_ch,
                        'followers': my_f
                    }
                    
        response_data = {
            'top_users': results,
            'current_user': current_user_data
        }
        
    finally:
        conn.close()
    return jsonify(response_data), 200
"""
with open('flask_app.py', 'a', encoding='utf-8') as f:
    f.write('\n\n' + code + '\n')
