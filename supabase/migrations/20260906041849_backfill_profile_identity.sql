update public.profiles p
set email=u.email, full_name=coalesce(p.full_name,u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name'), phone=coalesce(p.phone,u.phone), avatar_url=coalesce(p.avatar_url,u.raw_user_meta_data->>'avatar_url'), updated_at=now()
from auth.users u where u.id=p.id;
