import React, { useEffect, useState } from 'react';
import { getCourses, deleteCourse } from '../api';
import { Loader2, BookOpen, Clock, Users, PlayCircle, ExternalLink, Trash2, Edit3 } from 'lucide-react';

export default function CoursesDashboard({ onViewCourse, onEditCourse }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await getCourses();
      setCourses(res.courses || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (courseId) => {
    if (!window.confirm("Are you sure you want to delete this course?")) return;
    try {
      await deleteCourse(courseId);
      fetchCourses();
    } catch (err) {
      console.error("Failed to delete course", err);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20">
      <Loader2 className="h-12 w-12 animate-spin text-indigo-500 mb-4"/>
      <p className="text-gray-400 font-medium">Loading your academy...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-20 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-3xl font-black text-gray-900">Your Academy</h2>
           <p className="text-gray-500 mt-1">Manage and continue your learning journey.</p>
        </div>
        <div className="flex gap-2">
           <span className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-xs font-bold border border-indigo-100">
              {courses.length} Courses Total
           </span>
        </div>
      </div>
      
      {courses.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-20 text-center">
           <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-gray-400" />
           </div>
           <h3 className="text-xl font-bold text-gray-900 mb-2">No courses yet</h3>
           <p className="text-gray-500 max-w-sm mx-auto mb-8">
              You haven't built any courses. Use the "Create New Course" button to start your first AI-powered learning experience.
           </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {courses.map((course, idx) => {
             const data = course.details || {};
             const modCount = course.structure?.modules?.length || 0;
             const isVideoCourse = data.course_format === 'video';

             return (
               <div key={idx} className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-indigo-300 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col">
                  {/* Thumbnail / Header */}
                  <div className="relative h-48 w-full overflow-hidden bg-gray-100 border-b border-gray-100">
                     {data.thumbnail_url ? (
                        <img src={data.thumbnail_url} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                     ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-gray-100 flex items-center justify-center">
                           <PlayCircle className="w-16 h-16 text-indigo-200" />
                        </div>
                     )}
                     <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-transparent opacity-60" />
                     <div className="absolute top-4 right-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md border ${
                          data.difficulty === 'beginner' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                          data.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                          'bg-red-500/20 text-red-400 border-red-500/30'
                        }`}>
                          {data.difficulty}
                        </span>
                     </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col">
                     <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-indigo-600 transition">{data.title}</h3>
                     <p className="text-sm text-gray-500 mb-6 line-clamp-3 leading-relaxed">
                        {data.description}
                     </p>

                     <div className="mt-auto space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                           <div className="flex items-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                              <BookOpen className="h-3.5 w-3.5 text-indigo-500 mr-2" />
                              {modCount} Modules
                           </div>
                           <div className="flex items-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                              <Clock className="h-3.5 w-3.5 text-indigo-500 mr-2" />
                              {data.duration}
                           </div>
                        </div>
                        <div className="flex items-center text-[11px] font-bold text-gray-500 uppercase tracking-wider border-t border-gray-100 pt-4">
                           <Users className="h-3.5 w-3.5 text-indigo-500 mr-2" />
                           {data.target_audience}
                        </div>
                     </div>
                  </div>

                  <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-2">
                    <button 
                      onClick={() => onViewCourse && onViewCourse(course)}
                      className="flex-1 bg-white border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-gray-700 text-sm font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
                    >
                       <PlayCircle className="w-4 h-4" /> Start
                    </button>
                    <button 
                      onClick={() => onEditCourse && onEditCourse(course)}
                      className="bg-white border border-gray-200 hover:bg-yellow-50 hover:text-yellow-600 hover:border-yellow-200 text-gray-600 text-sm font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center shadow-sm"
                      title="Edit Course"
                    >
                       <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(course.id)}
                      className="bg-white border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-gray-600 text-sm font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center shadow-sm"
                      title="Delete Course"
                    >
                       <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
               </div>
             )
          })}
        </div>
      )}
    </div>
  );
}
